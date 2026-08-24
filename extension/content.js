const MAX_ACTIONS = 50;

let userActions = [];

// ==========================================
// RECORD ACTION
// ==========================================

async function recordAction(action) {
    try {
        const result = await chrome.storage.local.get([
            "captureActive",
            "userActions"
        ]);

        const captureActive =
            result.captureActive === true;

        if (!captureActive) {
            return;
        }

        userActions = result.userActions || [];

        const newAction = {
            ...action,
            timestamp: new Date().toISOString()
        };

        console.log("USER ACTION:", newAction);

        userActions.push(newAction);

        if (userActions.length > MAX_ACTIONS) {
            userActions = userActions.slice(-MAX_ACTIONS);
        }

        await chrome.storage.local.set({
            userActions: userActions
        });

    } catch (error) {
        console.error(
            "Failed to record user action:",
            error
        );
    }
}

// ==========================================
// CLICK TRACKING
// ==========================================

document.addEventListener(
    "click",
    (event) => {

        const element = event.target;

       recordAction({
    type: "CLICK",
    element: getElementName(element),
    tag: element.tagName,
    id: element.id || "",
    className:
        typeof element.className === "string"
            ? element.className
            : ""
});
    },
    true
);

// ==========================================
// INPUT TRACKING
// ==========================================

document.addEventListener(
    "input",
    (event) => {

        const element = event.target;

        recordAction({
    type: "INPUT",
    element: getElementName(element),
    tag: element.tagName,
    id: element.id || "",
    name: element.name || "",
    placeholder: element.placeholder || "",
    value: element.value || ""
});
    },
    true
);

// ==========================================
// ELEMENT TEXT
// ==========================================

function getElementName(element) {

    if (!element) {
        return "";
    }

    // 1. Visible text
    const text =
        element.innerText ||
        element.textContent ||
        "";

    if (text.trim()) {
        return text
            .trim()
            .replace(/\s+/g, " ")
            .substring(0, 100);
    }

    // 2. aria-label
    if (element.getAttribute("aria-label")) {
        return element
            .getAttribute("aria-label")
            .trim();
    }

    // 3. title
    if (element.getAttribute("title")) {
        return element
            .getAttribute("title")
            .trim();
    }

    // 4. placeholder
    if (element.getAttribute("placeholder")) {
        return element
            .getAttribute("placeholder")
            .trim();
    }

    // 5. input name
    if (element.getAttribute("name")) {
        return element
            .getAttribute("name")
            .trim();
    }

    // 6. ID
    if (element.id) {
        return element.id;
    }

    return "";
}