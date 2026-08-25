const MAX_ACTIONS = 50;


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

        // Recording is not active
        if (!captureActive) {
            return;
        }

        let userActions =
            result.userActions || [];


        // --------------------------------------
        // Create new action
        // --------------------------------------

        const newAction = {
            ...action,
            timestamp: new Date().toISOString()
        };


        console.log(
            "USER ACTION:",
            newAction
        );


        // --------------------------------------
        // Add action
        // --------------------------------------

        userActions.push(newAction);


        // --------------------------------------
        // Keep latest 50 actions
        // --------------------------------------

        if (
            userActions.length >
            MAX_ACTIONS
        ) {

            userActions =
                userActions.slice(
                    -MAX_ACTIONS
                );
        }


        // --------------------------------------
        // Save
        // --------------------------------------

        await chrome.storage.local.set({
            userActions: userActions
        });

    }
    catch (error) {

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

        let element =
            getMeaningfulElement(
                event.target
            );


        recordAction({

            type: "CLICK",

            element:
                getElementName(element),

            tag:
                element.tagName,

            id:
                element.id || "",

            className:
                typeof element.className === "string"
                    ? element.className
                    : "",

            role:
                element.getAttribute("role") || "",

            ariaLabel:
                element.getAttribute("aria-label") || "",

            title:
                element.getAttribute("title") || ""
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

        const element =
            event.target;


        recordAction({

            type: "INPUT",

            element:
                getElementName(element),

            tag:
                element.tagName,

            id:
                element.id || "",

            name:
                element.name || "",

            placeholder:
                element.placeholder || "",

            value:
                element.value || "",

            typeAttribute:
                element.type || ""
        });

    },
    true
);



// ==========================================
// FIND MEANINGFUL ELEMENT
// ==========================================

function getMeaningfulElement(element) {

    if (!element) {
        return document.body;
    }


    // --------------------------------------
    // If clicked element itself is meaningful
    // --------------------------------------

    const meaningfulTags = [
        "BUTTON",
        "A",
        "INPUT",
        "SELECT",
        "TEXTAREA",
        "OPTION",
        "LABEL"
    ];


    if (
        meaningfulTags.includes(
            element.tagName
        )
    ) {

        return element;
    }


    // --------------------------------------
    // Check parent elements
    // --------------------------------------

    const parent =
        element.closest(
            "button, a, input, select, textarea, option, label"
        );


    if (parent) {
        return parent;
    }


    // --------------------------------------
    // Check role
    // --------------------------------------

    const roleElement =
        element.closest(
            '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"]'
        );


    if (roleElement) {
        return roleElement;
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


    // --------------------------------------
    // 1. aria-label
    // --------------------------------------

    const ariaLabel =
        element.getAttribute(
            "aria-label"
        );

    if (
        ariaLabel &&
        ariaLabel.trim()
    ) {

        return cleanText(
            ariaLabel
        );
    }


    // --------------------------------------
    // 2. title
    // --------------------------------------

    const title =
        element.getAttribute(
            "title"
        );

    if (
        title &&
        title.trim()
    ) {

        return cleanText(
            title
        );
    }


    // --------------------------------------
    // 3. placeholder
    // --------------------------------------

    const placeholder =
        element.getAttribute(
            "placeholder"
        );

    if (
        placeholder &&
        placeholder.trim()
    ) {

        return cleanText(
            placeholder
        );
    }


    // --------------------------------------
    // 4. Input value
    // --------------------------------------

    if (
        element.tagName === "INPUT" &&
        element.value
    ) {

        return cleanText(
            element.value
        );
    }


    // --------------------------------------
    // 5. Button text
    // --------------------------------------

    if (
        element.tagName === "BUTTON"
    ) {

        const buttonText =
            element.innerText ||
            element.textContent ||
            "";

        if (
            buttonText.trim()
        ) {

            return cleanText(
                buttonText
            );
        }
    }


    // --------------------------------------
    // 6. Link text
    // --------------------------------------

    if (
        element.tagName === "A"
    ) {

        const linkText =
            element.innerText ||
            element.textContent ||
            "";

        if (
            linkText.trim()
        ) {

            return cleanText(
                linkText
            );
        }
    }


    // --------------------------------------
    // 7. Visible text
    // --------------------------------------

    const text =
        element.innerText ||
        element.textContent ||
        "";

    if (
        text.trim()
    ) {

        return cleanText(
            text
        );
    }


    // --------------------------------------
    // 8. Name attribute
    // --------------------------------------

    const name =
        element.getAttribute(
            "name"
        );

    if (
        name &&
        name.trim()
    ) {

        return cleanText(
            name
        );
    }


    // --------------------------------------
    // 9. ID
    // --------------------------------------

    if (
        element.id
    ) {

        return element.id;
    }


    // --------------------------------------
    // 10. Class
    // --------------------------------------

    if (
        typeof element.className === "string" &&
        element.className.trim()
    ) {

        return element.className
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .join(" ");
    }


    return element.tagName;
}



// ==========================================
// CLEAN TEXT
// ==========================================

function cleanText(text) {

    return text
        .trim()
        .replace(/\s+/g, " ")
        .substring(0, 100);
}