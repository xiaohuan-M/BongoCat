"""Build Pawside for Cloudflare Pages Git integration or Direct Upload."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.request import Request, urlopen
import zipfile


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'web'
CHUNK_SIZE = 16 * 1024 * 1024
UPLOAD_LIMIT = 25 * 1024 * 1024
NATIVE_RELEASES = (
    ('Pawside-Windows-x64.zip', 'Pawside/resources/app/'),
    ('Pawside-macOS-Apple-Silicon.zip', 'Pawside/PawsideApp/'),
)
ELECTRON_RELEASES = {
    '45.4.1': {
        'win32-x64': '2ba6223afa9121f42831fefe92c434334907540165294fc56697449d12e7cfe9',
        'darwin-arm64': 'd080c3b05a01bd16137f2c12ab9ebf083c577757fe846844ba325bafa8e8bdf4',
    }
}


def put_files(archive, folder, prefix=''):
    for file in sorted(folder.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts:
            archive.write(file, prefix + file.relative_to(folder).as_posix())


def copy_entry(source, archive, item, name):
    entry = copy.copy(item)
    entry.filename = name
    if item.is_dir():
        archive.writestr(entry, b'')
    else:
        with source.open(item) as input_file, archive.open(entry, 'w') as output_file:
            shutil.copyfileobj(input_file, output_file, length=1024 * 1024)


def update_desktop(original, destination, prefix):
    updates = {
        prefix + item.relative_to(ROOT).as_posix(): item
        for item in (ROOT / 'package.json', ROOT / 'README.md', *APP.rglob('*'))
        if item.is_file()
    }
    with zipfile.ZipFile(original) as source, zipfile.ZipFile(destination, 'w', allowZip64=True) as archive:
        paths = set(source.namelist())
        for item in source.infolist():
            replacement = updates.get(item.filename)
            if replacement:
                archive.writestr(copy.copy(item), replacement.read_bytes())
            else:
                copy_entry(source, archive, item, item.filename)
        for name in updates.keys() - paths:
            archive.write(updates[name], name, compress_type=zipfile.ZIP_DEFLATED)


def fetch_electron(version, target, folder):
    expected = ELECTRON_RELEASES[version][target]
    name = f'electron-v{version}-{target}.zip'
    file = folder / name
    request = Request(
        f'https://github.com/electron/electron/releases/download/v{version}/{name}',
        headers={'User-Agent': 'Pawside-Pages-Build'},
    )
    print(f'Downloading {name}', flush=True)
    with urlopen(request, timeout=90) as response, file.open('wb') as output:
        shutil.copyfileobj(response, output, length=1024 * 1024)
    with file.open('rb') as input_file:
        checksum = hashlib.file_digest(input_file, 'sha256').hexdigest()
    if checksum != expected:
        raise RuntimeError(f'SHA-256 mismatch for {name}')
    return file


def put_application(archive, app_prefix, modules, target):
    for folder in ('desktop', 'web', 'licenses'):
        put_files(archive, ROOT / folder, app_prefix + folder + '/')
    for file in ('package.json', 'README.md', 'LICENSE'):
        archive.write(ROOT / file, app_prefix + file)

    hook = modules / 'uiohook-napi'
    if not list((hook / 'prebuilds' / target).glob('*.node')):
        raise RuntimeError(f'uiohook-napi has no prebuild for {target}')
    hook_path = app_prefix + 'node_modules/uiohook-napi/'
    for file in sorted(hook.rglob('*')):
        relative = file.relative_to(hook)
        if file.is_file() and (relative.parts[0] != 'prebuilds' or relative.parts[1] == target):
            archive.write(file, hook_path + relative.as_posix())
    put_files(archive, modules / 'node-gyp-build', app_prefix + 'node_modules/node-gyp-build/')


def package_desktop_from_source(binaries):
    electron_version = json.loads((ROOT / 'package-lock.json').read_text())[
        'packages'
    ]['node_modules/electron']['version']
    if electron_version not in ELECTRON_RELEASES:
        raise RuntimeError(f'Pin the Windows and macOS checksums for Electron {electron_version}')
    with tempfile.TemporaryDirectory(prefix='pawside-runtime-', dir=binaries.parent) as temp:
        staging = Path(temp)
        for name in ('package.json', 'package-lock.json'):
            shutil.copyfile(ROOT / name, staging / name)
        subprocess.run(
            ['npm', 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
            cwd=staging, check=True,
        )
        modules = staging / 'node_modules'
        win_target, mac_target = 'win32-x64', 'darwin-arm64'
        win_runtime = fetch_electron(electron_version, win_target, staging)
        win_name, win_prefix = NATIVE_RELEASES[0]
        with zipfile.ZipFile(win_runtime) as source, zipfile.ZipFile(
            binaries / win_name, 'w', zipfile.ZIP_DEFLATED
        ) as archive:
            for item in source.infolist():
                if item.filename == 'resources/default_app.asar':
                    continue
                name = 'Pawside.exe' if item.filename == 'electron.exe' else item.filename
                copy_entry(source, archive, item, 'Pawside/' + name)
            put_application(archive, win_prefix, modules, win_target)

        mac_runtime = fetch_electron(electron_version, mac_target, staging)
        mac_name, mac_prefix = NATIVE_RELEASES[1]
        with zipfile.ZipFile(binaries / mac_name, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.write(mac_runtime, 'Pawside/runtime/Electron-arm64.zip', compress_type=zipfile.ZIP_STORED)
            archive.write(ROOT / 'tools/start-portable-mac.command', 'Pawside/Start-Pawside.command')
            put_application(archive, mac_prefix, modules, mac_target)


def add_release(file, parts_dir, mime, version):
    with file.open('rb') as input_file:
        checksum = hashlib.file_digest(input_file, 'sha256').hexdigest()
    release_dir = parts_dir / checksum
    release_dir.mkdir(exist_ok=True)
    size = 0
    parts = []
    with file.open('rb') as contents:
        for index, data in enumerate(iter(lambda: contents.read(CHUNK_SIZE), b'')):
            name = f'{file.name}.{index:02}.bin'
            (release_dir / name).write_bytes(data)
            size += len(data)
            parts.append({'path': f'/release-parts/{version}/{checksum}/{name}', 'size': len(data)})
    return {'type': mime, 'sha256': checksum, 'size': size, 'parts': parts}


def make_source(name):
    sections = ('desktop', 'site', 'web', 'tools', 'licenses')
    files = (
        '.gitignore', 'LICENSE', 'README.md', 'REFERENCE-WORKFLOW.md', 'DEPLOY.md',
        'package.json', 'package-lock.json', 'start-mac.command', 'start-windows.cmd',
    )
    with zipfile.ZipFile(name, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for relative in sections:
            put_files(archive, ROOT / relative, f'Pawside/{relative}/')
        for relative in files:
            archive.write(ROOT / relative, f'Pawside/{relative}')


def build_pages(dist, binaries, version, runtimes, file_limit):
    binaries.mkdir()
    shutil.copytree(ROOT / 'site', dist)
    shutil.copytree(APP, dist / 'studio')
    entry = dist / 'studio/index.html'
    entry.write_text(entry.read_text(encoding='utf-8').replace(
        'class="home-link" href="../" hidden', 'class="home-link" href="../"'), encoding='utf-8')
    shutil.copyfile(ROOT / 'DEPLOY.md', dist / 'DEPLOY.md')
    parts_dir = dist / 'release-parts' / version
    parts_dir.mkdir(parents=True)

    if runtimes:
        for name, prefix in NATIVE_RELEASES:
            update_desktop(runtimes / name, binaries / name, prefix)
    else:
        package_desktop_from_source(binaries)
    offline = binaries / 'Pawside-Studio.html'
    subprocess.run(['node', str(ROOT / 'tools/build-studio.cjs'), str(offline.resolve())], check=True)
    make_source(binaries / 'Pawside-Source.zip')

    manifest = {}
    for file in sorted(binaries.iterdir()):
        mime = 'application/octet-stream' if file.suffix == '.html' else 'application/zip'
        manifest[file.name] = add_release(file, parts_dir, mime, version)
        print(f"{file.name}: {manifest[file.name]['size']:,} bytes, {len(manifest[file.name]['parts'])} parts", flush=True)

    worker = dist / '_worker.js'
    worker.write_text(worker.read_text().replace('/* RELEASES */ {}', json.dumps(manifest, indent=2)))
    (binaries / 'SHA256SUMS').write_text(''.join(f"{release['sha256']}  {name}\n" for name, release in manifest.items()))

    assets = [file for file in dist.rglob('*') if file.is_file()]
    if len(assets) > file_limit or any(file.stat().st_size > UPLOAD_LIMIT for file in assets):
        raise RuntimeError('The output exceeds Cloudflare Pages asset limits')
    return len(assets)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtimes', type=Path,
                        help='Optionally reuse a folder with the previous Windows and Mac Pawside ZIPs')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--pages', action='store_true', help='Build the Git deployment into dist/')
    mode.add_argument('--out', type=Path, help='Build a Direct Upload ZIP and loose downloads here')
    args = parser.parse_args()
    version = json.loads((ROOT / 'package.json').read_text())['version']
    if args.pages:
        output = ROOT / 'dist'
        with tempfile.TemporaryDirectory(prefix='.pages-build-', dir=ROOT) as temp:
            staging = Path(temp)
            dist = staging / 'dist'
            count = build_pages(dist, staging / 'downloads', version, args.runtimes, 20_000)
            previous = staging / 'previous'
            if output.exists():
                output.rename(previous)
            try:
                dist.rename(output)
            except OSError:
                if previous.exists():
                    previous.rename(output)
                raise
        print(f'{output}: {count} files', flush=True)
        return

    args.out.mkdir(parents=True, exist_ok=False)
    dist = args.out / 'dist'
    count = build_pages(dist, args.out / 'downloads', version, args.runtimes, 1_000)
    name = args.out / f'Pawside-Cloudflare-v{version}.zip'
    with zipfile.ZipFile(name, 'w', zipfile.ZIP_DEFLATED, compresslevel=2) as archive:
        put_files(archive, dist)
    print(f'{name}: {count} files', flush=True)


if __name__ == '__main__':
    main()
