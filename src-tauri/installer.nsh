; ============================================================
; ErgeHash NSIS 安装器钩子：注册 Windows 右键菜单
; 注意：Tauri 定义的可用宏包括 ${MAINBINARYNAME}、${PRODUCTNAME}、
; ${INSTDIR}、${VERSION} 等；不要引用未定义的 ${APP_BINARY_NAME}。
; ============================================================

; 替换底部 Nullsoft 水印，显示产品名
BrandingText "${PRODUCTNAME} 安装程序"

; 复用宏：为指定扩展名注册「用 ErgeHash 验证」顶层项
; EXEPATH: 主程序可执行文件完整路径（含 .exe）
!macro WRITE_VERIFY_EXT EXT EXEPATH
  WriteRegStr HKLM "Software\Classes\${EXT}\shell\ErgeHashVerify" "" "用 ErgeHash 验证"
  WriteRegStr HKLM "Software\Classes\${EXT}\shell\ErgeHashVerify" "Icon" "${EXEPATH},0"
  WriteRegStr HKLM "Software\Classes\${EXT}\shell\ErgeHashVerify\command" "" '"${EXEPATH}" --verify "%1"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; 文件右键并排顶层项
  DeleteRegKey HKLM "Software\Classes\*\shell\ErgeHashMD5"
  DeleteRegKey HKLM "Software\Classes\*\shell\ErgeHashSHA1"
  DeleteRegKey HKLM "Software\Classes\*\shell\ErgeHashSHA256"
  DeleteRegKey HKLM "Software\Classes\*\shell\ErgeHashSHA512"
  DeleteRegKey HKLM "Software\Classes\*\shell\ErgeHashCRC32"
  DeleteRegKey HKLM "Software\Classes\*\shell\ErgeHashCompare"
  DeleteRegKey HKLM "Software\Classes\*\shell\ErgeHashVerify"

  ; 校验文件专用右键项
  DeleteRegKey HKLM "Software\Classes\.md5\shell\ErgeHashVerify"
  DeleteRegKey HKLM "Software\Classes\.sha\shell\ErgeHashVerify"
  DeleteRegKey HKLM "Software\Classes\.sha1\shell\ErgeHashVerify"
  DeleteRegKey HKLM "Software\Classes\.sha256\shell\ErgeHashVerify"
  DeleteRegKey HKLM "Software\Classes\.sha512\shell\ErgeHashVerify"
  DeleteRegKey HKLM "Software\Classes\.sfv\shell\ErgeHashVerify"

  ; 目录背景右键项
  DeleteRegKey HKLM "Software\Classes\Directory\Background\shell\ErgeHashDir"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; 主程序可执行文件路径（带 .exe）
  !define ERGEBIN "$INSTDIR\${MAINBINARYNAME}.exe"

  ; ============================================================
  ; 1) 任意文件右键：每个算法独立顶层项（Win10/Win11 均并排显示）。
  ;    Windows 11 新版菜单不展开「shell\子项」级联，因此改为并排顶层项，
  ;    与常见工具（如 7-Zip）一致。显示名前缀 ErgeHash: 便于识别来源。
  ; ============================================================
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashMD5" "" "ErgeHash: 计算 MD5"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashMD5" "Icon" "${ERGEBIN},0"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashMD5\command" "" '"${ERGEBIN}" --algo md5 "%1"'

  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashSHA1" "" "ErgeHash: 计算 SHA-1"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashSHA1" "Icon" "${ERGEBIN},0"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashSHA1\command" "" '"${ERGEBIN}" --algo sha1 "%1"'

  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashSHA256" "" "ErgeHash: 计算 SHA-256"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashSHA256" "Icon" "${ERGEBIN},0"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashSHA256\command" "" '"${ERGEBIN}" --algo sha256 "%1"'

  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashSHA512" "" "ErgeHash: 计算 SHA-512"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashSHA512" "Icon" "${ERGEBIN},0"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashSHA512\command" "" '"${ERGEBIN}" --algo sha512 "%1"'

  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashCRC32" "" "ErgeHash: 计算 CRC32"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashCRC32" "Icon" "${ERGEBIN},0"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashCRC32\command" "" '"${ERGEBIN}" --algo crc32 "%1"'

  ; 对比文件：选中 2+ 文件，计算同一算法哈希并判断是否完全一致（SHA-256 默认）。
  ; 多选时 Windows 仅把首个文件传入 %1，靠应用内「单实例累积」机制合并其余文件。
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashCompare" "" "ErgeHash: 对比文件"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashCompare" "Icon" "${ERGEBIN},0"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashCompare\command" "" '"${ERGEBIN}" --compare "%1"'

  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashVerify" "" "ErgeHash: 用校验文件验证"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashVerify" "Icon" "${ERGEBIN},0"
  WriteRegStr HKLM "Software\Classes\*\shell\ErgeHashVerify\command" "" '"${ERGEBIN}" --verify "%1"'

  ; ============================================================
  ; 2) 校验文件独立顶层项（Win11 现代菜单可直接显示）
  ; ============================================================
  !insertmacro WRITE_VERIFY_EXT ".md5" "${ERGEBIN}"
  !insertmacro WRITE_VERIFY_EXT ".sha" "${ERGEBIN}"
  !insertmacro WRITE_VERIFY_EXT ".sha1" "${ERGEBIN}"
  !insertmacro WRITE_VERIFY_EXT ".sha256" "${ERGEBIN}"
  !insertmacro WRITE_VERIFY_EXT ".sha512" "${ERGEBIN}"
  !insertmacro WRITE_VERIFY_EXT ".sfv" "${ERGEBIN}"

  ; ============================================================
  ; 3) 目录空白处右键：递归计算当前目录 SHA-256
  ; %V 在 Directory\Background 中表示当前目录路径
  ; ============================================================
  WriteRegStr HKLM "Software\Classes\Directory\Background\shell\ErgeHashDir" "" "ErgeHash: 计算 SHA-256"
  WriteRegStr HKLM "Software\Classes\Directory\Background\shell\ErgeHashDir" "Icon" "${ERGEBIN},0"
  WriteRegStr HKLM "Software\Classes\Directory\Background\shell\ErgeHashDir\command" "" '"${ERGEBIN}" --algo sha256 "%V"'
!macroend
