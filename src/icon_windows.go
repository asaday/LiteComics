//go:build windows && !cui

package main

import _ "embed"

//go:embed icons/icon.ico
var iconBytes []byte
