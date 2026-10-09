const MAX_ACTIONS = 50;

let extensionContextInvalidated = false;

// Input tracking helpers
const inputDebounceTimers = new WeakMap();
const lastRecordedInputValues = new WeakMap();

// ==========================================
// EXTENSION CONTEXT CHECK
// ==========================================

function isExtensionContextValid() {
    try {
        return !!(
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            chrome.runtime.id
        );
    } catch (error) {
        return false;
    }
}

// ==========================================
// CHECK INVALIDATED ERROR
// ==========================================

function isExtensionContextInvalidatedError(error) {
    if (!error) {
        return false;
    }

    const message = String(error.message || error).toLowerCase();

    return (
        message.includes("extension context invalidated") ||
        message.includes("receiving end does not exist") ||
        message.includes("message port closed")
    );
}

// ==========================================
// SAFE MESSAGE TO BACKGROUND
// ==========================================

async function sendActionToBackground(action) {
    if (extensionContextInvalidated) {
        return;
    }

    if (!isExtensionContextValid()) {
        extensionContextInvalidated = true;
        return;
    }

    try {
        await chrome.runtime.sendMessage({
            type: "RECORD_ACTION",
            action: action
        });
    } catch (error) {
        if (isExtensionContextInvalidatedError(error)) {
            extensionContextInvalidated = true;
        }
    }
}

// ==========================================
// RECORD ACTION
// ==========================================

function recordAction(action) {
    if (extensionContextInvalidated) {
        return;
    }

    if (!isExtensionContextValid()) {
        extensionContextInvalidated = true;
        return;
    }

    if (!action || !action.type) {
        return;
    }

    const newAction = {
        ...action,
        timestamp: new Date().toISOString()
    };

    sendActionToBackground(newAction);
}

// ==========================================
// CLICK TRACKING
// ==========================================

document.addEventListener(
    "click",
    (event) => {
        if (extensionContextInvalidated) {
            return;
        }

        const element = getMeaningfulElement(event.target);

        if (!element) {
            return;
        }

        recordAction({
            type: "CLICK",
            element: getElementName(element),
            tag: element.tagName || "",
            id: element.id || "",
            className:
                typeof element.className === "string"
                    ? element.className
                    : "",
            role: element.getAttribute("role") || "",
            ariaLabel: element.getAttribute("aria-label") || "",
            title: element.getAttribute("title") || ""
        });
    },
    true
);

// ==========================================
// INPUT TRACKING - FINAL VALUE ONLY
// ==========================================

function recordFinalInput(element) {
    if (!element || extensionContextInvalidated) {
        return;
    }

    if (!isExtensionContextValid()) {
        extensionContextInvalidated = true;
        return;
    }

    const value = String(element.value ?? "");

    // Skip unchanged values.
    if (lastRecordedInputValues.get(element) === value) {
        return;
    }

    lastRecordedInputValues.set(element, value);

    recordAction({
        type: "INPUT",
        element: getElementName(element),
        tag: element.tagName || "",
        id: element.id || "",
        name: element.name || "",
        placeholder: element.placeholder || "",
        value: value,
        typeAttribute: element.type || ""
    });
}

function flushPendingInput(element) {
    if (!element) {
        return;
    }

    const timer = inputDebounceTimers.get(element);

    if (timer) {
        clearTimeout(timer);
        inputDebounceTimers.delete(element);
    }

    recordFinalInput(element);
}

document.addEventListener(
    "input",
    (event) => {
        if (extensionContextInvalidated) {
            return;
        }

        const element = event.target;

        if (
            !element ||
            !["INPUT", "TEXTAREA"].includes(element.tagName)
        ) {
            return;
        }

        const existingTimer = inputDebounceTimers.get(element);

        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Wait until the user pauses typing.
        const timer = setTimeout(() => {
            inputDebounceTimers.delete(element);
            recordFinalInput(element);
        }, 800);

        inputDebounceTimers.set(element, timer);
    },
    true
);

// Record final value when the user leaves a field.
document.addEventListener(
    "focusout",
    (event) => {
        const element = event.target;

        if (
            !element ||
            !["INPUT", "TEXTAREA"].includes(element.tagName)
        ) {
            return;
        }

        flushPendingInput(element);
    },
    true
);

// Record final value when a field is committed.
document.addEventListener(
    "change",
    (event) => {
        const element = event.target;

        if (
            !element ||
            !["INPUT", "TEXTAREA"].includes(element.tagName)
        ) {
            return;
        }

        flushPendingInput(element);
    },
    true
);

// ==========================================
// CHANGE TRACKING - DROPDOWNS
// ==========================================

document.addEventListener(
    "change",
    (event) => {
        if (extensionContextInvalidated) {
            return;
        }

        const element = event.target;

        if (!element) {
            return;
        }

        if (element.tagName === "SELECT") {
            recordAction({
                type: "SELECT",
                element: getElementName(element),
                value: element.value || "",
                id: element.id || "",
                name: element.name || ""
            });
        }
    },
    true
);

// ==========================================
// MESSAGE LISTENER
// ==========================================

try {
    if (isExtensionContextValid()) {
        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                if (!message || !message.type) {
                    return;
                }

                // PING
                if (message.type === "AI_BUG_REPORTER_PING") {
                    try {
                        sendResponse({
                            ok: true,
                            contentScript: true
                        });
                    } catch (error) {
                        // Ignore response errors.
                    }

                    return true;
                }

                // CONTEXT CHECK
                if (
                    message.type ===
                    "AI_BUG_REPORTER_CONTEXT_CHECK"
                ) {
                    try {
                        sendResponse({
                            ok: isExtensionContextValid()
                        });
                    } catch (error) {
                        sendResponse({
                            ok: false
                        });
                    }

                    return true;
                }
            }
        );
    }
} catch (error) {
    extensionContextInvalidated = true;
}

// ==========================================
// FIND MEANINGFUL ELEMENT
// ==========================================

function getMeaningfulElement(element) {
    if (!element) {
        return document.body;
    }

    const meaningfulTags = [
        "BUTTON",
        "A",
        "INPUT",
        "SELECT",
        "TEXTAREA",
        "OPTION",
        "LABEL"
    ];

    if (meaningfulTags.includes(element.tagName)) {
        return element;
    }

    try {
        const parent = element.closest(
            "button, a, input, select, textarea, option, label"
        );

        if (parent) {
            return parent;
        }
    } catch (error) {
        // Ignore.
    }

    try {
        const roleElement = element.closest(
            '[role="button"], [role="link"], ' +
            '[role="checkbox"], [role="radio"], ' +
            '[role="tab"], [role="menuitem"]'
        );

        if (roleElement) {
            return roleElement;
        }
    } catch (error) {
        // Ignore.
    }

    return element;
}

// ==========================================
// GET ELEMENT NAME
// ==========================================

function getElementName(element) {
    if (!element) {
        return "Unknown element";
    }

    const ariaLabel = element.getAttribute("aria-label");

    if (ariaLabel && ariaLabel.trim()) {
        return cleanText(ariaLabel);
    }

    const title = element.getAttribute("title");

    if (title && title.trim()) {
        return cleanText(title);
    }

    const placeholder = element.getAttribute("placeholder");

    if (placeholder && placeholder.trim()) {
        return cleanText(placeholder);
    }

    // Prefer field labels over the entered value.
    if (
        element.labels &&
        element.labels.length > 0
    ) {
        const labelText = Array.from(element.labels)
            .map(label => label.innerText || label.textContent || "")
            .join(" ")
            .trim();

        if (labelText) {
            return cleanText(labelText);
        }
    }

    const name = element.getAttribute("name");

    if (name && name.trim()) {
        return cleanText(name);
    }

    if (element.id) {
        return cleanText(element.id);
    }

    if (
        element.tagName === "BUTTON" ||
        element.tagName === "A"
    ) {
        const text =
            element.innerText ||
            element.textContent ||
            "";

        if (text.trim()) {
            return cleanText(text);
        }
    }

    const text =
        element.innerText ||
        element.textContent ||
        "";

    if (text.trim()) {
        return cleanText(text);
    }

    if (
        typeof element.className === "string" &&
        element.className.trim()
    ) {
        return cleanText(
            element.className
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .join(" ")
        );
    }

    return element.tagName || "Unknown element";
}

// ==========================================
// CLEAN TEXT
// ==========================================

function cleanText(text) {
    return String(text || "")
        .trim()
        .replace(/\s+/g, " ")
        .substring(0, 150);
}