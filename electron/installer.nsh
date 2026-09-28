; Antes de instalar/atualizar: fecha qualquer Laçolaria que tenha sobrado aberto
; (inclusive o servidor interno), para o instalador conseguir trocar os arquivos.
!macro customInit
  nsExec::Exec 'taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  Sleep 1500
!macroend
