$action = New-ScheduledTaskAction -Execute "C:\Users\lindb\Repos\Agent\run-agent.bat" -WorkingDirectory "C:\Users\lindb\Repos\Agent"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "lindb"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "EmailAgentDaily" -Action $action -Trigger $trigger -Settings $settings -Description "Daily email summary agent"

Write-Host "Scheduled task 'EmailAgentDaily' created successfully!"
Write-Host "The email agent will run automatically when you log in."
