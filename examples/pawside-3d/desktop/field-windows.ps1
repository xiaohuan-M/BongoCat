# Emit only the protected/unprotected property, never a value, title or field name.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
while ($true) {
  $result = '?'
  try {
    $element = [System.Windows.Automation.AutomationElement]::FocusedElement
    if ($null -ne $element) {
      $flag = $element.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::IsPasswordProperty, $true)
      if ($flag -is [bool]) {
        if ($flag) { $result = 'P' } else { $result = 'O' }
      }
    }
  } catch {}
  [Console]::WriteLine($result)
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 400
}
