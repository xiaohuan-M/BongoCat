// System osascript / JavaScript for Automation. Only read the focused control's subrole.
ObjC.import('Cocoa');
ObjC.import('ApplicationServices');
function run() {
  const system = $.AXUIElementCreateSystemWide();
  const stdout = $.NSFileHandle.fileHandleWithStandardOutput;
  while (true) {
    let state = '?';
    try {
      const focus = Ref(),
        role = Ref();
      if (
        $.AXUIElementCopyAttributeValue(
          system,
          $('AXFocusedUIElement'),
          focus
        ) === 0 &&
        $.AXUIElementCopyAttributeValue(focus[0], $('AXSubrole'), role) === 0
      ) {
        state = ObjC.unwrap(role[0]) === 'AXSecureTextField' ? 'P' : 'O';
      }
    } catch (_) {}
    stdout.writeData($(state + '\n').dataUsingEncoding($.NSUTF8StringEncoding));
    $.NSThread.sleepForTimeInterval(0.4);
  }
}
