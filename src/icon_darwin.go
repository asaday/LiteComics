//go:build darwin && !cui

package main

import _ "embed"

//go:embed icons/icon.icns
var iconBytes []byte
