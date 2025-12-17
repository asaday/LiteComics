#define MyAppName "LiteComics"
#define MyAppVersion GetEnv("VERSION")
#define MyAppPublisher "asaday"
#define MyAppURL "https://github.com/asaday/LiteComics"
#define MyAppExeName "litecomics-windows-amd64.exe"

[Setup]
AppId={{8B7A9F5E-3C2D-4E1F-9A8B-7C5E4D3F2A1B}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=dist
OutputBaseFilename=litecomics-windows-{#MyAppVersion}-setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupicon"; Description: "Start at Windows startup"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
Source: "build\{#MyAppExeName}"; DestDir: "{app}"; DestName: "litecomics.exe"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\litecomics.exe"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\litecomics.exe"; Tasks: desktopicon
Name: "{commonstartup}\{#MyAppName}"; Filename: "{app}\litecomics.exe"; Tasks: startupicon

[Run]
Filename: "{app}\litecomics.exe"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
