ShowInstDetails show
ShowUninstDetails show

!macro closeLinkweaverProcess
  DetailPrint "Closing running Linkweaver process if present..."
  nsExec::ExecToLog 'taskkill /IM Linkweaver.exe /T'
  Sleep 1000
  nsExec::ExecToLog 'taskkill /IM Linkweaver.exe /F /T'
!macroend

!macro customInit
  !insertmacro closeLinkweaverProcess
!macroend

!macro customUnInit
  !insertmacro closeLinkweaverProcess
!macroend
