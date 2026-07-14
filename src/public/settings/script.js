let config = null;

async function loadSettings() {
    try {
        const res = await fetch('/api/settings/config');
        const data = await res.json();
        config = data.config || data; // Handle both new and old format

        // Display config path
        if (data.configPath) {
            document.getElementById('config-path-value').textContent = data.configPath;
        }

        document.getElementById('port').value = config.port || 8539;
        document.getElementById('disableGUI').checked = config.disableGUI === true;
        document.getElementById('defaultLTR').checked = config.defaultLTR === true;
        document.getElementById('allowFileOperations').checked = config.allowFileOperations === true;
        document.getElementById('allowUpload').checked = config.allowUpload === true;

        // Load TLS config
        if (config.tls) {
            document.getElementById('tlsCertFile').value = config.tls.certFile || '';
            document.getElementById('tlsKeyFile').value = config.tls.keyFile || '';
        }

        const rootsDiv = document.getElementById('roots');
        rootsDiv.innerHTML = '';

        if (config.roots && config.roots.length > 0) {
            config.roots.forEach((root, i) => {
                addRootItem(
                    typeof root === 'string' ? root : root.path,
                    typeof root === 'object' ? root.name : '',
                    typeof root === 'object' && root.uploadDisabled === true
                );
            });
        } else {
            addRoot();
        }
    } catch (err) {
        showMessage('Failed to load settings: ' + err.message, 'error');
    }
}

function addRootItem(path = '', name = '', uploadDisabled = false) {
    const rootsDiv = document.getElementById('roots');
    const div = document.createElement('div');
    div.className = 'root-item';

    const pathInput = document.createElement('input');
    pathInput.type = 'text';
    pathInput.className = 'root-text-input root-path-input';
    pathInput.placeholder = '/path/to/comics';
    pathInput.value = path;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'root-text-input root-name-input';
    nameInput.placeholder = 'Name (optional)';
    nameInput.value = name;

    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'root-upload-control';
    uploadLabel.title = 'When enabled, uploads to this root are rejected.';

    const uploadCheckbox = document.createElement('input');
    uploadCheckbox.type = 'checkbox';
    uploadCheckbox.className = 'root-upload-disabled';
    uploadCheckbox.checked = uploadDisabled;

    const uploadText = document.createElement('span');
    uploadText.textContent = 'Disable Upload';

    uploadLabel.appendChild(uploadCheckbox);
    uploadLabel.appendChild(uploadText);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-danger btn-small';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => div.remove();

    div.appendChild(pathInput);
    div.appendChild(nameInput);
    div.appendChild(uploadLabel);
    div.appendChild(removeBtn);
    rootsDiv.appendChild(div);
}

function addRoot() {
    addRootItem();
}

function getRootsFromUI() {
    const items = document.querySelectorAll('.root-item');
    const roots = [];
    items.forEach(item => {
        const path = item.querySelector('.root-path-input').value.trim();
        const name = item.querySelector('.root-name-input').value.trim();
        const uploadDisabled = item.querySelector('.root-upload-disabled').checked;

        if (path) {
            if (name || uploadDisabled) {
                const root = { path };
                if (name) root.name = name;
                if (uploadDisabled) root.uploadDisabled = true;
                roots.push(root);
            } else {
                roots.push(path);
            }
        }
    });
    return roots;
}

async function saveSettings() {
    try {
        const port = parseInt(document.getElementById('port').value);
        const roots = getRootsFromUI();

        if (isNaN(port) || port < 1024 || port > 65535) {
            showMessage('Error: Port must be between 1024 and 65535', 'error');
            return;
        }

        if (roots.length === 0) {
            showMessage('Error: At least one root directory is required', 'error');
            return;
        }

        const newConfig = {
            port: port,
            roots: roots
        };

        // Add disableGUI setting
        const disableGUI = document.getElementById('disableGUI').checked;
        if (disableGUI) {
            newConfig.disableGUI = true;
        }

        // Add defaultLTR setting
        const defaultLTR = document.getElementById('defaultLTR').checked;
        if (defaultLTR) {
            newConfig.defaultLTR = true;
        }

        const allowFileOperations = document.getElementById('allowFileOperations').checked;
        if (allowFileOperations) {
            newConfig.allowFileOperations = true;
        }
        const allowUpload = document.getElementById('allowUpload').checked;
        if (allowUpload) {
            newConfig.allowUpload = true;
        }

        // Add TLS settings if provided
        const tlsCertFile = document.getElementById('tlsCertFile').value.trim();
        const tlsKeyFile = document.getElementById('tlsKeyFile').value.trim();
        if (tlsCertFile && tlsKeyFile) {
            newConfig.tls = {
                certFile: tlsCertFile,
                keyFile: tlsKeyFile
            };
        }

        const res = await fetch('/api/settings/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'Failed to save settings');
        }

        showMessage('Settings saved successfully!', 'success');
    } catch (err) {
        showMessage('Error: ' + err.message, 'error');
    }
}


async function saveAndRestart() {
    // Confirm restart (use native confirm)
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Restart the server now?')
        : true;
    if (!ok) {
        return;
    }

    await saveSettings();

    try {
        await fetch('/api/settings/restart', { method: 'POST' });
        showMessage('Server is restarting...', 'success');

        // Immediate shutdown is used on the server; try quick reload
        setTimeout(() => {
            location.reload();
        }, 1000);
    } catch (err) {
        showMessage('Settings saved, but restart failed. Please restart manually.', 'error');
    }
}

function showMessage(text, type) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = 'message ' + type;
    msg.style.display = 'block';
}

loadSettings();
