const reportBugButton =
    document.getElementById("reportBug");

const startCaptureButton =
    document.getElementById("startCapture");

const stopCaptureButton =
    document.getElementById("stopCapture");

const descriptionInput =
    document.getElementById("description");

const loading =
    document.getElementById("loading");

const result =
    document.getElementById("result");

const error =
    document.getElementById("error");

const copyJsonButton =
    document.getElementById("copyJson");

let bugData = null;

async function restoreRecordingState() {

    try {

        const result =
            await chrome.storage.local.get([
                "captureActive",
                "userActions"
            ]);

        const captureActive =
            result.captureActive === true;

        const actions =
            result.userActions || [];

        console.log(
            "Recording state:",
            captureActive
        );

        console.log(
            "Current actions:",
            actions
        );

        if (captureActive) {

            startCaptureButton.disabled = true;

            stopCaptureButton.disabled = false;

            reportBugButton.disabled = true;

            startCaptureButton.textContent =
                "🔴 Recording...";

        } else {

            startCaptureButton.disabled = false;

            stopCaptureButton.disabled = true;

            reportBugButton.disabled =
                actions.length === 0;

            startCaptureButton.textContent =
                "▶️ Start Recording";
        }

    } catch (error) {

        console.error(
            "Unable to restore recording state:",
            error
        );
    }
}

restoreRecordingState();



// ==========================================
// START CAPTURE
// ==========================================

startCaptureButton.addEventListener(
    "click",
    async () => {

        try {

            // Clear previous actions
            await chrome.storage.local.set({
                userActions: [],
                captureActive: true
            });

            console.log(
                "Recording started."
            );

            console.log(
                "Old actions cleared."
            );

            startCaptureButton.disabled = true;

            stopCaptureButton.disabled = false;

            reportBugButton.disabled = true;

            startCaptureButton.textContent =
                "🔴 Recording...";

            // Close popup after starting
            window.close();

        } catch (error) {

            console.error(
                "Start recording failed:",
                error
            );

            showError(
                "Unable to start recording."
            );
        }
    }
);

stopCaptureButton.addEventListener(
    "click",
    async () => {

        try {

            const result =
                await chrome.storage.local.get([
                    "userActions"
                ]);

            const actions =
                result.userActions || [];

            await chrome.storage.local.set({
                captureActive: false
            });

            console.log(
                "Recording stopped."
            );

            console.log(
                "Captured actions:",
                actions
            );

            startCaptureButton.disabled = false;

            stopCaptureButton.disabled = true;

            reportBugButton.disabled =
                actions.length === 0;

            startCaptureButton.textContent =
                "▶️ Start Recording";

        } catch (error) {

            console.error(
                "Stop recording failed:",
                error
            );

            showError(
                "Unable to stop recording."
            );
        }
    }
);


// ==========================================
// REPORT BUG
// ==========================================

reportBugButton.addEventListener("click", async () => {

    try {

        hideError();

        const description =
            descriptionInput.value.trim();


        // --------------------------------------
        // Validate description
        // --------------------------------------

        if (!description) {

            showError(
                "Please describe the bug first."
            );

            return;
        }


        // --------------------------------------
        // Show loading
        // --------------------------------------

        loading.classList.remove("hidden");

        result.classList.add("hidden");

        reportBugButton.disabled = true;


        // --------------------------------------
        // Get active tab
        // --------------------------------------

        const tabs =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });


        if (!tabs || tabs.length === 0) {

            throw new Error(
                "Active tab could not be found."
            );
        }


        const tab = tabs[0];


        // --------------------------------------
        // Capture screenshot
        // --------------------------------------

        const screenshot =
            await chrome.tabs.captureVisibleTab(
                null,
                {
                    format: "png"
                }
            );


        // --------------------------------------
        // Get browser information
        // --------------------------------------

        const browserInfo =
            getBrowserInfo();

            // --------------------------------------
// Get User Actions
// --------------------------------------
// --------------------------------------
// Get User Actions
// --------------------------------------
const actionData = await chrome.storage.local.get([
    "userActions"
]);

const userActions =
    actionData.userActions || [];

console.log("CAPTURED USER ACTIONS:", userActions);


        // --------------------------------------
        // Create bug object
        // --------------------------------------

bugData = {

    bugTitle:
        generateBugTitle(description),

    description:
        description,

    url:
        tab.url || "",

    pageTitle:
        tab.title || "",

    browser:
        browserInfo.browser,

    browserVersion:
        browserInfo.version,

    userAgent:
        navigator.userAgent,

    capturedAt:
        new Date().toISOString(),

    stepsToReproduce:
        generateSteps(userActions),

    actualResult:
        description,

    expectedResult:
        generateExpectedResult(description),

    userActions:
        userActions,

    screenshot:
        screenshot
};

// Stop recording
await chrome.storage.local.set({
    captureActive: false
});

startCaptureButton.disabled = false;

stopCaptureButton.disabled = true;

reportBugButton.disabled = true;

startCaptureButton.textContent =
    "▶️ Start Recording";


        console.log(
            "BUG DATA:",
            bugData
        );

        console.log(
    "EXPECTED RESULT GENERATED:",
    bugData.expectedResult
);


        // --------------------------------------
        // Store locally
        // --------------------------------------

        await chrome.storage.local.set({

            lastBugReport:
                bugData

        });


        // --------------------------------------
        // Display result
        // --------------------------------------

        displayBugData(
            bugData
        );


    } catch (err) {

        console.error(
            "Bug capture failed:",
            err
        );

        showError(
            err.message ||
            "Something went wrong while capturing bug."
        );

    } finally {

        loading.classList.add("hidden");

        reportBugButton.disabled = false;

    }

});


// ==========================================
// DISPLAY BUG DATA
// ==========================================

function displayBugData(data) {

    // ==========================================
    // BASIC BUG INFORMATION
    // ==========================================

    document.getElementById("resultDescription").textContent =
        data.description || "";

    document.getElementById("resultUrl").textContent =
        data.url || "";

    document.getElementById("resultTitle").textContent =
        data.pageTitle || "";

    document.getElementById("resultBrowser").textContent =
        `${data.browser || ""} ${data.browserVersion || ""}`;

    document.getElementById("resultTime").textContent =
        data.capturedAt || "";


    // ==========================================
    // STEPS TO REPRODUCE
    // ==========================================

    const stepsContainer =
        document.getElementById("stepsToReproduce");

    stepsContainer.innerHTML = "";

    if (
        data.stepsToReproduce &&
        data.stepsToReproduce.length > 0
    ) {

        data.stepsToReproduce.forEach(
            (step, index) => {

                const stepElement =
                    document.createElement("p");

                stepElement.textContent =
                    `${index + 1}. ${step}`;

                stepsContainer.appendChild(
                    stepElement
                );
            }
        );

    } else {

        stepsContainer.textContent =
            "No steps captured.";
    }


    // ==========================================
    // ACTUAL RESULT
    // ==========================================

    document.getElementById("actualResult").textContent =
        data.actualResult || "";


    // ==========================================
    // EXPECTED RESULT
    // ==========================================

    document.getElementById("expectedResult").textContent =
        data.expectedResult || "";


    // ==========================================
    // USER ACTIONS
    // ==========================================

    const userActionsContainer =
        document.getElementById("userActions");

    userActionsContainer.innerHTML = "";

    if (
        data.userActions &&
        data.userActions.length > 0
    ) {

        data.userActions.forEach(
            (action, index) => {

                const actionElement =
                    document.createElement("p");

                let stepText = "";

                if (action.type === "CLICK") {

                    stepText =
                        `User clicked on "${
                            action.element ||
                            action.tag
                        }"`;

                } else if (
                    action.type === "INPUT"
                ) {

                    stepText =
                        `User entered "${
                            action.value || ""
                        }" in "${
                            action.element ||
                            action.placeholder ||
                            action.tag
                        }"`;

                } else {

                    stepText =
                        `${action.type} on "${
                            action.element ||
                            action.tag
                        }"`;
                }

                actionElement.textContent =
                    `${index + 1}. ${stepText}`;

                userActionsContainer.appendChild(
                    actionElement
                );
            }
        );

    } else {

        userActionsContainer.textContent =
            "No user actions captured.";
    }


    // ==========================================
    // SCREENSHOT
    // ==========================================

    document.getElementById("screenshot").src =
        data.screenshot || "";


    // ==========================================
    // SHOW RESULT
    // ==========================================

    result.classList.remove("hidden");
}

//
// ==========================================
// BROWSER DETECTION
// ==========================================

function getBrowserInfo() {

    const userAgent =
        navigator.userAgent;


    let browser =
        "Unknown";

    let version =
        "Unknown";


    if (
        userAgent.includes("Edg/")
    ) {

        browser = "Microsoft Edge";

        version =
            userAgent.match(
                /Edg\/([\d.]+)/
            )?.[1] || "Unknown";

    }

    else if (
        userAgent.includes("Chrome/")
    ) {

        browser = "Google Chrome";

        version =
            userAgent.match(
                /Chrome\/([\d.]+)/
            )?.[1] || "Unknown";

    }

    else if (
        userAgent.includes("Firefox/")
    ) {

        browser = "Mozilla Firefox";

        version =
            userAgent.match(
                /Firefox\/([\d.]+)/
            )?.[1] || "Unknown";

    }

    else if (
        userAgent.includes("Safari/")
    ) {

        browser = "Safari";

        version =
            userAgent.match(
                /Version\/([\d.]+)/
            )?.[1] || "Unknown";

    }


    return {
        browser,
        version
    };

}


// ==========================================
// COPY JSON
// ==========================================

copyJsonButton.addEventListener(
    "click",
    async () => {

        if (!bugData) {

            showError(
                "No bug data available."
            );

            return;
        }


        try {

            await navigator.clipboard.writeText(
                JSON.stringify(
                    bugData,
                    null,
                    2
                )
            );


            copyJsonButton.textContent =
                "✅ Copied!";


            setTimeout(() => {

                copyJsonButton.textContent =
                    "📋 Copy Bug Data";

            }, 2000);


        } catch (err) {

            showError(
                "Unable to copy bug data."
            );

        }

    }
);


// ==========================================
// ERROR HANDLING
// ==========================================

function showError(message) {

    error.textContent =
        message;

    error.classList.remove(
        "hidden"
    );

}


function hideError() {

    error.classList.add(
        "hidden"
    );

}

// ==========================================
// GENERATE BUG TITLE
// ==========================================

function generateBugTitle(description) {

    if (!description) {
        return "Bug Report";
    }

    return description
        .trim()
        .replace(/\.$/, "");
}

// ==========================================
// GENERATE STEPS
// ==========================================

function generateSteps(actions) {

    if (!actions || actions.length === 0) {
        return [];
    }

    return actions.map(
        (action) => {

            if (action.type === "CLICK") {

                return `Click on "${
                    action.element ||
                    action.tag ||
                    "element"
                }"`;

            }

            if (action.type === "INPUT") {

                return `Enter "${
                    action.value || ""
                }" in "${
                    action.element ||
                    action.placeholder ||
                    action.tag ||
                    "field"
                }"`;

            }

            return `${action.type} on "${
                action.element ||
                action.tag ||
                "element"
            }"`;
        }
    );
}


// ==========================================
// GENERATE EXPECTED RESULT
// ==========================================

function generateExpectedResult(description) {

    if (!description || !description.trim()) {
        return "The application should behave as per the defined requirements.";
    }

    const original = description.trim();
    const text = original.toLowerCase();


    // ==========================================
    // NOT APPEARING / NOT DISPLAYED
    // ==========================================

    if (
        text.includes("not appearing") ||
        text.includes("not visible") ||
        text.includes("not displayed") ||
        text.includes("not showing") ||
        text.includes("not shown") ||
        text.includes("missing")
    ) {

        let subject = original;

        subject = subject
            .replace(/\s+is\s+not\s+appearing.*$/i, "")
            .replace(/\s+is\s+not\s+visible.*$/i, "")
            .replace(/\s+is\s+not\s+displayed.*$/i, "")
            .replace(/\s+is\s+not\s+showing.*$/i, "")
            .replace(/\s+is\s+not\s+shown.*$/i, "")
            .replace(/\s+is\s+missing.*$/i, "")
            .trim();

        return `${capitalize(subject)} should be displayed correctly to the user.`;
    }


    // ==========================================
    // NOT WORKING
    // ==========================================

    if (
        text.includes("not working") ||
        text.includes("does not work") ||
        text.includes("not functioning") ||
        text.includes("not responding")
    ) {

        let subject = original;

        subject = subject
            .replace(/\s+is\s+not\s+working.*$/i, "")
            .replace(/\s+does\s+not\s+work.*$/i, "")
            .replace(/\s+is\s+not\s+functioning.*$/i, "")
            .replace(/\s+is\s+not\s+responding.*$/i, "")
            .trim();

        return `${capitalize(subject)} should work correctly as per the expected functionality.`;
    }


    // ==========================================
    // NOT SAVING
    // ==========================================

    if (
        text.includes("not saving") ||
        text.includes("does not save") ||
        text.includes("not saved")
    ) {

        let subject = original;

        subject = subject
            .replace(/\s+is\s+not\s+saving.*$/i, "")
            .replace(/\s+does\s+not\s+save.*$/i, "")
            .replace(/\s+is\s+not\s+saved.*$/i, "")
            .trim();

        return `${capitalize(subject)} should be saved successfully.`;
    }


    // ==========================================
    // NOT LOADING
    // ==========================================

    if (
        text.includes("not loading") ||
        text.includes("does not load")
    ) {

        let subject = original;

        subject = subject
            .replace(/\s+is\s+not\s+loading.*$/i, "")
            .replace(/\s+does\s+not\s+load.*$/i, "")
            .trim();

        return `${capitalize(subject)} should load successfully without any error.`;
    }


    // ==========================================
    // WRONG / INCORRECT DATA
    // ==========================================

    if (
        text.includes("wrong data") ||
        text.includes("incorrect data") ||
        text.includes("wrong value") ||
        text.includes("incorrect value")
    ) {

        return "The system should display the correct data as per the defined requirements.";
    }


    // ==========================================
    // DUPLICATE
    // ==========================================

    if (
        text.includes("duplicate") ||
        text.includes("duplicated")
    ) {

        return "Duplicate records or elements should not be created or displayed.";
    }


    // ==========================================
    // ERROR
    // ==========================================

    if (
        text.includes("error") ||
        text.includes("exception") ||
        text.includes("failed")
    ) {

        return "The operation should complete successfully without displaying any unexpected error.";
    }


    // ==========================================
    // DEFAULT
    // ==========================================

    return "The functionality should work as per the defined requirements.";
}


// ==========================================
// CAPITALIZE
// ==========================================

function capitalize(text) {

    if (!text) {
        return "The affected functionality";
    }

    return text.charAt(0).toUpperCase() + text.slice(1);
}