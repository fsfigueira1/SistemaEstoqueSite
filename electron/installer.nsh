; Antes de instalar/atualizar ou desinstalar: fecha qualquer Laçolaria que
; tenha sobrado aberto (inclusive o servidor interno), para o instalador
; conseguir trocar/apagar os arquivos. Sem /T: o servidor interno também
; se chama Laçolaria.exe, e o /T poderia derrubar o próprio instalador
; (que a atualização abre como "filho" do app). Sem isso a atualização podia apagar a
; versão velha e não conseguir pôr a nova.
!macro customInit
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}"'
  Sleep 1500
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}"'
  Sleep 1500
!macroend
