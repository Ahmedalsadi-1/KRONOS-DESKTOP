; KRONOS Custom Installer Script
; This script creates custom NSIS installer with better branding and options

!macro customWelcomePage
  !define MUI_CUSTOMPAGE_WELCOME_SUBTITLE "KRONOS Desktop Agent Setup"
  !define MUI_CUSTOMPAGE_WELCOME_TEXT "KRONOS Desktop Agent v1.0.0$\r$\n$\r$\nThis AI-powered desktop automation platform includes:$\r$\n• Embedded AI services for computer vision and automation$\r$\n• Web automation using Puppeteer$\r$\n• Text analysis and OCR capabilities$\r$\n• Cross-platform support (Windows, macOS, Linux)$\r$\n$\r$\nClick Next to continue."
  !define MUI_CUSTOMPAGE_WELCOME_TITLE "Welcome to KRONOS Desktop Agent"

!macro customComponentsPage
  !define MUI_CUSTOMPAGE_COMPONENTS_SUBTITLE "Choose Components"
  !define MUI_CUSTOMPAGE_COMPONENTS_TEXT "Select which KRONOS components to install:$\r$\n$\r$\n☑ AI Core Services (Recommended)$\r$\n$\r$\n☑ Web Automation Module$\r$\n$\r$\n☑ Computer Vision Module$\r$\n$\r$\n☑ Android Control Module$\r$\n$\r$\n☑ Documentation and Examples"
  !define MUI_CUSTOMPAGE_COMPONENTS_TITLE "Select Components"

!macro customFinishPage
  !define MUI_CUSTOMPAGE_FINISH_SUBTITLE "Installation Complete"
  !define MUI_CUSTOMPAGE_FINISH_TEXT "KRONOS Desktop Agent has been successfully installed!$\r$\n$\r$\n• Launch: KRONOS Desktop Agent.exe$\r$\n$\r$\n• Documentation: Available in Help menu$\r$\n$\r$\n• Updates: Automatic checking enabled"
  !define MUI_CUSTOMPAGE_FINISH_TITLE "Setup Complete"

!macro setSections
  ; Set installation directory
  !insertmacro setInstallDirectory $INSTDIR "ProgramFilesFolder"

; Modern UI settings
!include "MUI2.nsh"
!define MUI_ICON "kronos-icon.ico"
!define MUI_UNICON "kronos-uninstall.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP_NOSTRETCH
!define MUI_BGCOLOR "0xFFFFFF"
!define MUI_TEXTCOLOR "0x000000"
!define MUI_UI_TEXTCOLOR "0x333333"

; Installation sections
Section "MainSection" SEC01
  SectionInRO 1 "AI Core Services are required"
  AddSize 1024
  SetOutPath "$INSTDIR\KRONOS\Desktop Agent\ai-services"
  File /r "ai-services\*.*" "AI Core Services files"

Section "WebAutomation" SEC02
  SectionInRO 1 "Web Automation components"
  AddSize 512
  SetOutPath "$INSTDIR\KRONOS\Desktop Agent\web-automation"
  File /r "web-automation\*.*" "Web Automation files"

Section "ComputerVision" SEC03
  SectionInRO 1 "Computer Vision components"
  AddSize 256
  SetOutPath "$INSTDIR\KRONOS\Desktop Agent\computer-vision"
  File /r "computer-vision\*.*" "Computer Vision files"

Section "AndroidControl" SEC04
  SectionInRO 1 "Android Control components"
  AddSize 128
  SetOutPath "$INSTDIR\KRONOS\Desktop Agent\android-control"
  File /r "android-control\*.*" "Android Control files"

Section "Documentation" SEC05
  SectionInRO 1 "Documentation and examples"
  AddSize 64
  SetOutPath "$INSTDIR\KRONOS\Desktop Agent\documentation"
  File /r "documentation\*.*" "Documentation files"

; Optional components with descriptions
Section /o "OptionalComponents" "Optional Components"
  SectionInRO 2 "Optional components for extended functionality"
  
  ComponentText "AI Services (Core)"
  ComponentDescription "Essential AI core services"
  ComponentSize 512
  AddSize 0
  SetOutPath "$INSTDIR\KRONOS\Desktop Agent\ai-services"
  File /r "ai-services\README.md" "AI services documentation"
  File /r "ai-services\config.json" "AI services configuration"
  
  ComponentText "Web Automation Module"
  ComponentDescription "Web automation and scraping capabilities"
  ComponentSize 256
  AddSize 0
  SetOutPath "$INSTDIR\KRONOS\Desktop Agent\web-automation"
  File /r "web-automation\README.md" "Web automation documentation"
  File /r "web-automation\config.json" "Web automation configuration"

; Installation pages
!insertmacro MUI_PAGE_WELCOME "customWelcomePage"
!insertmacro MUI_PAGE_COMPONENTS "customComponentsPage"
!insertmacro MUI_PAGE_FINISH "customFinishPage"

; Shortcuts
!define MUI_STARTMENU_FOLDER "KRONOS Desktop Agent"
!define MUI_STARTMENU_RUN "Launch KRONOS Desktop Agent"

; Registry entries
Section "Software.Registries"
  WriteRegStr HKLM "Software\KRONOS\Desktop Agent" "InstallPath" "$INSTDIR\KRONOS\Desktop Agent"
  WriteRegStr HKLM "Software\KRONOS\Desktop Agent" "Version" "1.0.0"
  WriteRegStr HKLM "Software\KRONOS\Desktop Agent" "InstallDate" "%DATE%"

; Post-installation
Section "PostInstall"
  CreateShortCut "$DESKTOP" "KRONOS Desktop Agent.lnk" "$INSTDIR\KRONOS\Desktop Agent\KRONOS Desktop Agent.exe"
  ExecShell "open" "https://docs.kronos.ai" "Documentation"

; Uninstallation
Section "Uninstall"
  Delete "$INSTDIR\KRONOS\Desktop Agent" -R
  Delete "$SMPROGRAMS\KRONOS\Desktop Agent" -R
  DeleteRegKey HKLM "Software\KRONOS\Desktop Agent"
  RMDir /r "$APPDATA\KRONOS Desktop Agent"