const reportBugButton = document.getElementById("reportBug");
const startCaptureButton = document.getElementById("startCapture");
const stopCaptureButton = document.getElementById("stopCapture");
const descriptionInput = document.getElementById("description");
const loading = document.getElementById("loading");
const result = document.getElementById("result");
const error = document.getElementById("error");
const copyJsonButton = document.getElementById("copyJson");

// Expected Result Edit Controls
const expectedResultInput =
    document.getElementById("expectedResultInput");

const saveExpectedResultButton =
    document.getElementById("saveExpectedResult");

const expectedResultSaved =
    document.getElementById("expectedResultSaved");

let bugData = null;
let expectedResultSource = "DEFAULT";


// ==========================================
// RESTORE RECORDING STATE
// ==========================================

async function restoreRecordingState() {
    try {
        const storage = await chrome.storage.local.get([
            "captureActive",
            "userActions"
        ]);

        const captureActive = storage.captureActive === true;
        const actions = storage.userActions || [];

        console.log("Restoring recording state:", {
            captureActive,
            actionsCount: actions.length
        });

        if (captureActive) {

            // Recording is already running
            startCaptureButton.disabled = true;
            stopCaptureButton.disabled = false;
            reportBugButton.disabled = true;

            startCaptureButton.textContent =
                "🔴 Recording...";

        } else {

            // Recording is not running
            startCaptureButton.disabled = false;
            stopCaptureButton.disabled = true;

            reportBugButton.disabled =
                actions.length === 0;

            startCaptureButton.textContent =
                "▶️ Start Recording";
        }

    } catch (err) {

        console.error(
            "Unable to restore recording state:",
            err
        );

        // IMPORTANT
        // Always make Start Recording clickable
        startCaptureButton.disabled = false;
        stopCaptureButton.disabled = true;
        reportBugButton.disabled = true;

        startCaptureButton.textContent =
            "▶️ Start Recording";
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

            console.log(
                "Start Recording clicked."
            );


            // ==========================================
            // RESET OLD DATA
            // ==========================================

            await chrome.storage.local.set({
                userActions: [],
                captureActive: true,
                videoRecordingActive: false,
                videoRecordingError: ""
            });


            // ==========================================
            // START VIDEO
            // ==========================================

            try {

                const response =
                    await chrome.runtime.sendMessage({
                        type: "START_VIDEO"
                    });

                console.log(
                    "Video start response:",
                    response
                );

            } catch (videoError) {

                console.error(
                    "Video recording could not start:",
                    videoError
                );

                // Video fail hone par bhi
                // action recording continue rahegi.
            }


            // ==========================================
            // UPDATE BUTTONS
            // ==========================================

            startCaptureButton.disabled = true;
            stopCaptureButton.disabled = false;
            reportBugButton.disabled = true;

            startCaptureButton.textContent =
                "🔴 Recording...";


            console.log(
                "Action recording started."
            );


            // ==========================================
            // CLOSE POPUP
            // ==========================================

            window.close();

        } catch (err) {

            console.error(
                "Start recording failed:",
                err
            );


            // ==========================================
            // SAFETY RESET
            // ==========================================

            await chrome.storage.local.set({
                captureActive: false
            });

            startCaptureButton.disabled = false;
            stopCaptureButton.disabled = true;
            reportBugButton.disabled = true;

            startCaptureButton.textContent =
                "▶️ Start Recording";

            showError(
                "Unable to start recording."
            );
        }
    }
);


// ==========================================
// STOP CAPTURE
// ==========================================

stopCaptureButton.addEventListener(
    "click",
    async () => {

        try {

            console.log(
                "Stop Recording clicked."
            );


            // ==========================================
            // STOP ACTION RECORDING
            // ==========================================

            await chrome.storage.local.set({
                captureActive: false
            });


            // ==========================================
            // GET ACTIONS
            // ==========================================

            const storage =
                await chrome.storage.local.get([
                    "userActions"
                ]);

            const actions =
                storage.userActions || [];

            console.log(
                "Captured actions:",
                actions
            );


            // ==========================================
            // STOP VIDEO
            // ==========================================

            try {

                const response =
                    await chrome.runtime.sendMessage({
                        type: "STOP_VIDEO"
                    });

                console.log(
                    "Video stop response:",
                    response
                );

            } catch (videoError) {

                console.error(
                    "Unable to stop video:",
                    videoError
                );
            }


            // ==========================================
            // UPDATE BUTTONS
            // ==========================================

            startCaptureButton.disabled = false;
            stopCaptureButton.disabled = true;

            reportBugButton.disabled =
                actions.length === 0;

            startCaptureButton.textContent =
                "▶️ Start Recording";


            console.log(
                "Recording stopped successfully."
            );

        } catch (err) {

            console.error(
                "Stop recording failed:",
                err
            );


            // ==========================================
            // FORCE RESET
            // ==========================================

            await chrome.storage.local.set({
                captureActive: false
            });

            startCaptureButton.disabled = false;
            stopCaptureButton.disabled = true;

            startCaptureButton.textContent =
                "▶️ Start Recording";

            showError(
                "Unable to stop recording."
            );
        }
    }
);


// ==========================================
// REPORT BUG
// ==========================================

reportBugButton.addEventListener(
    "click",
    async () => {

        try {

            hideError();


            // ==========================================
            // DESCRIPTION / ACTUAL RESULT
            // ==========================================

            const description =
                descriptionInput.value.trim();

            if (!description) {

                showError(
                    "Please describe the bug first."
                );

                return;
            }


            // ==========================================
            // SHOW LOADING
            // ==========================================

            loading.classList.remove("hidden");
            result.classList.add("hidden");

            reportBugButton.disabled = true;


            // ==========================================
            // GET ACTIVE TAB
            // ==========================================

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


            // ==========================================
            // CAPTURE SCREENSHOT
            // ==========================================

            const screenshot =
                await chrome.tabs.captureVisibleTab(
                    null,
                    {
                        format: "png"
                    }
                );


            // ==========================================
            // GET SAVED VIDEO
            // ==========================================

            let savedVideo = null;

            try {

                savedVideo =
                    await getLatestBugVideo();

                if (savedVideo) {

                    console.log(
                        "Saved bug video found."
                    );

                } else {

                    console.log(
                        "No saved bug video found."
                    );
                }

            } catch (videoError) {

                console.error(
                    "Unable to get saved bug video:",
                    videoError
                );
            }


            // ==========================================
            // BROWSER INFORMATION
            // ==========================================

            const browserInfo =
                getBrowserInfo();


            // ==========================================
            // GET USER ACTIONS
            // ==========================================

            const actionData =
                await chrome.storage.local.get([
                    "userActions"
                ]);

            const userActions =
                actionData.userActions || [];

            console.log(
                "CAPTURED USER ACTIONS:",
                userActions
            );


            // ==========================================
            // GENERATE CLEAN USER ACTIONS
            // ==========================================

            const cleanUserActions =
                generateUserActions(
                    userActions
                );

            console.log(
                "CLEAN USER ACTIONS:",
                cleanUserActions
            );


            // ==========================================
            // GENERATE STEPS
            // ==========================================

            const generatedSteps =
                generateSteps(
                    userActions
                );

            console.log(
                "GENERATED STEPS:",
                generatedSteps
            );


            // ==========================================
            // GENERATE EXPECTED RESULT
            // ==========================================

            const generatedExpectedResult =
                generateExpectedResult(
                    description
                );

            console.log(
                "EXPECTED RESULT:",
                generatedExpectedResult
            );

            console.log(
                "EXPECTED RESULT SOURCE:",
                expectedResultSource
            );


            // ==========================================
            // CREATE BUG OBJECT
            // ==========================================

            bugData = {

                bugTitle:
                    generateBugTitle(
                        description
                    ),

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


                // ======================================
                // STEPS TO REPRODUCE
                // ======================================

                stepsToReproduce:
                    generatedSteps,


                // ======================================
                // ACTUAL RESULT
                // ======================================

                actualResult:
                    description,


                // ======================================
                // EXPECTED RESULT
                // ======================================

                expectedResult:
                    generatedExpectedResult,


                // ======================================
                // EXPECTED RESULT SOURCE
                // ======================================

                expectedResultSource:
                    expectedResultSource,


                // ======================================
                // USER ACTIONS
                // ======================================

                userActions:
                    cleanUserActions,


                // ======================================
                // SCREENSHOT
                // ======================================

                screenshot:
                    screenshot,


                // ======================================
                // VIDEO RECORDING
                // ======================================

                video: {
                    available:
                        !!savedVideo
                }
            };


            // ==========================================
            // STOP RECORDING
            // ==========================================

            await chrome.storage.local.set({
                captureActive: false
            });

            startCaptureButton.disabled = false;
            stopCaptureButton.disabled = true;
            reportBugButton.disabled = true;

            startCaptureButton.textContent =
                "▶️ Start Recording";


            // ==========================================
            // STORE BUG DATA
            // ==========================================

            await chrome.storage.local.set({
                lastBugReport:
                    bugData
            });


            console.log(
                "BUG DATA:",
                bugData
            );


            // ==========================================
            // DISPLAY RESULT
            // ==========================================

            await displayBugData(
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

            // Only enable Report Bug if there is
            // captured data available
            try {

                const storage =
                    await chrome.storage.local.get([
                        "userActions"
                    ]);

                const actions =
                    storage.userActions || [];

                reportBugButton.disabled =
                    actions.length === 0;

            } catch (e) {

                reportBugButton.disabled = false;
            }
        }
    }
);


// ==========================================
// DISPLAY BUG DATA
// ==========================================

async function displayBugData(data) {

    // ==========================================
    // EDITABLE EXPECTED RESULT
    // ==========================================

    const expectedResultInputElement =
        document.getElementById(
            "expectedResultInput"
        );

    if (expectedResultInputElement) {

        expectedResultInputElement.value =
            data.expectedResult || "";
    }


    // ==========================================
    // EXPECTED RESULT SOURCE
    // ==========================================

    const expectedResultSourceElement =
        document.getElementById(
            "expectedResultSource"
        );

    if (expectedResultSourceElement) {

        if (
            data.expectedResultSource ===
            "AI_FALLBACK"
        ) {

            expectedResultSourceElement.textContent =
                "🤖 Generated using AI Fallback";

        } else if (
            data.expectedResultSource ===
            "RULE_ENGINE"
        ) {

            expectedResultSourceElement.textContent =
                "⚙️ Generated using Rule Engine";

        } else if (
            data.expectedResultSource ===
            "MANUAL"
        ) {

            expectedResultSourceElement.textContent =
                "✏️ Manually edited";

        } else {

            expectedResultSourceElement.textContent =
                "Generated automatically";
        }
    }


    // ==========================================
    // URL
    // ==========================================

    const resultUrl =
        document.getElementById(
            "resultUrl"
        );

    if (resultUrl) {

        resultUrl.textContent =
            data.url || "";
    }


    // ==========================================
    // PAGE TITLE
    // ==========================================

    const resultTitle =
        document.getElementById(
            "resultTitle"
        );

    if (resultTitle) {

        resultTitle.textContent =
            data.pageTitle || "";
    }


    // ==========================================
    // BROWSER
    // ==========================================

    const resultBrowser =
        document.getElementById(
            "resultBrowser"
        );

    if (resultBrowser) {

        resultBrowser.textContent =
            `${data.browser || ""} ${data.browserVersion || ""}`;
    }


    // ==========================================
    // CAPTURE TIME
    // ==========================================

    const resultTime =
        document.getElementById(
            "resultTime"
        );

    if (resultTime) {

        resultTime.textContent =
            data.capturedAt || "";
    }


    // ==========================================
    // STEPS TO REPRODUCE
    // ==========================================

    const stepsContainer =
        document.getElementById(
            "stepsToReproduce"
        );

    if (stepsContainer) {

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
    }


    // ==========================================
    // ACTUAL RESULT
    // ==========================================

    const actualResult =
        document.getElementById(
            "actualResult"
        );

    if (actualResult) {

        actualResult.textContent =
            data.actualResult || "";
    }


    // ==========================================
    // EXPECTED RESULT
    // ==========================================

    const expectedResult =
        document.getElementById(
            "expectedResult"
        );

    if (expectedResult) {

        expectedResult.textContent =
            data.expectedResult || "";
    }


    // ==========================================
    // USER ACTIONS
    // ==========================================

    const userActionsContainer =
        document.getElementById(
            "userActions"
        );

    if (userActionsContainer) {

        userActionsContainer.innerHTML = "";

        if (
            data.userActions &&
            data.userActions.length > 0
        ) {

            data.userActions.forEach(
                (action, index) => {

                    const actionElement =
                        document.createElement("p");

                    actionElement.textContent =
                        `${index + 1}. ${action.type} → ${action.value}`;

                    userActionsContainer.appendChild(
                        actionElement
                    );
                }
            );

        } else {

            userActionsContainer.textContent =
                "No user actions captured.";
        }
    }


    // ==========================================
    // SCREENSHOT
    // ==========================================

    const screenshotElement =
        document.getElementById(
            "screenshot"
        );

    if (screenshotElement) {

        screenshotElement.src =
            data.screenshot || "";
    }


    // ==========================================
    // VIDEO
    // ==========================================

    const bugVideo =
        document.getElementById(
            "bugVideo"
        );

    const videoStatus =
        document.getElementById(
            "videoStatus"
        );

    if (bugVideo && videoStatus) {

        if (
            data.video &&
            data.video.available === true
        ) {

            try {

                const videoData =
                    await getLatestBugVideo();

                if (videoData) {

                    bugVideo.src =
                        URL.createObjectURL(
                            videoData
                        );

                    videoStatus.textContent =
                        "✅ Bug video recorded successfully.";

                } else {

                    videoStatus.textContent =
                        "⚠️ Video not found.";
                }

            } catch (videoError) {

                console.error(
                    "Unable to load bug video:",
                    videoError
                );

                videoStatus.textContent =
                    "⚠️ Unable to load video.";
            }

        } else {

            videoStatus.textContent =
                "No video available.";
        }
    }


    // ==========================================
    // SHOW RESULT
    // ==========================================

    result.classList.remove("hidden");
}


// ==========================================
// SAVE / EDIT EXPECTED RESULT
// ==========================================

if (saveExpectedResultButton) {

    saveExpectedResultButton.addEventListener(
        "click",
        async () => {

            try {

                hideError();

                if (!bugData) {

                    showError(
                        "No bug data available."
                    );

                    return;
                }


                const editedExpectedResult =
                    expectedResultInput
                        ? expectedResultInput.value.trim()
                        : "";


                if (!editedExpectedResult) {

                    showError(
                        "Expected Result cannot be empty."
                    );

                    return;
                }


                // ==================================
                // UPDATE BUG DATA
                // ==================================

                bugData.expectedResult =
                    editedExpectedResult;


                // ==================================
                // MARK AS MANUAL
                // ==================================

                bugData.expectedResultSource =
                    "MANUAL";

                expectedResultSource =
                    "MANUAL";


                // ==================================
                // UPDATE DISPLAY
                // ==================================

                const expectedResult =
                    document.getElementById(
                        "expectedResult"
                    );

                if (expectedResult) {

                    expectedResult.textContent =
                        editedExpectedResult;
                }


                // ==================================
                // SAVE TO STORAGE
                // ==================================

                await chrome.storage.local.set({
                    lastBugReport:
                        bugData
                });


                // ==================================
                // UPDATE SOURCE TEXT
                // ==================================

                const sourceElement =
                    document.getElementById(
                        "expectedResultSource"
                    );

                if (sourceElement) {

                    sourceElement.textContent =
                        "✏️ Manually edited";
                }


                // ==================================
                // SHOW SUCCESS MESSAGE
                // ==================================

                if (expectedResultSaved) {

                    expectedResultSaved.textContent =
                        "✅ Expected Result updated successfully.";

                    expectedResultSaved.classList.remove(
                        "hidden"
                    );

                    setTimeout(
                        () => {

                            expectedResultSaved.classList.add(
                                "hidden"
                            );

                        },
                        2000
                    );
                }


                console.log(
                    "Expected Result updated:",
                    editedExpectedResult
                );

            } catch (err) {

                console.error(
                    "Unable to save Expected Result:",
                    err
                );

                showError(
                    "Unable to save Expected Result."
                );
            }
        }
    );
}


// ==========================================
// GENERATE CLEAN USER ACTIONS
// ==========================================

function generateUserActions(actions) {

    if (
        !actions ||
        actions.length === 0
    ) {
        return [];
    }


    const cleanActions = [];


    actions.forEach((action) => {

        if (!action || !action.type) {
            return;
        }


        // ======================================
        // CLICK
        // ======================================

        if (action.type === "CLICK") {

            const name =
                getSmartActionName(action);

            if (
                !name ||
                isTechnicalElement(name)
            ) {
                return;
            }


            cleanActions.push({
                type: "CLICK",
                value: name
            });

            return;
        }


        // ======================================
        // INPUT
        // ======================================

        if (action.type === "INPUT") {

            const value =
                (action.value || "").trim();

            if (!value) {
                return;
            }


            const field =
                getInputField(action);


            const lastAction =
                cleanActions[
                    cleanActions.length - 1
                ];


            // Replace previous INPUT
            // for same field

            if (
                lastAction &&
                lastAction.type === "INPUT" &&
                lastAction.field === field
            ) {

                lastAction.value =
                    value;

                return;
            }


            cleanActions.push({
                type: "INPUT",
                value: value,
                field: field
            });

            return;
        }


        // ======================================
        // OTHER ACTIONS
        // ======================================

        const name =
            getSmartActionName(action);

        if (
            !name ||
            isTechnicalElement(name)
        ) {
            return;
        }


        cleanActions.push({
            type:
                formatActionType(
                    action.type
                ),

            value:
                name
        });

    });


    // Remove internal field
    // before display

    return cleanActions.map((action) => {

        return {
            type:
                action.type,

            value:
                action.value
        };

    });
}


// ==========================================
// GET INPUT FIELD
// ==========================================

function getInputField(action) {

    if (!action) {
        return "input field";
    }


    const field =
        action.element ||
        action.placeholder ||
        action.name ||
        action.id ||
        "input field";


    return String(field)
        .trim()
        .replace(/\s+/g, " ");
}


// ==========================================
// GENERATE STEPS
// ==========================================

function generateSteps(actions) {

    if (
        !actions ||
        actions.length === 0
    ) {
        return [];
    }


    const steps = [];
    const cleanActions = [];


    // ==========================================
    // FIRST CLEAN ACTIONS
    // ==========================================

    actions.forEach((action) => {

        if (!action || !action.type) {
            return;
        }


        // ======================================
        // CLICK
        // ======================================

        if (action.type === "CLICK") {

            const elementName =
                getSmartActionName(action);

            if (
                !elementName ||
                isTechnicalElement(elementName)
            ) {
                return;
            }


            cleanActions.push({
                type: "CLICK",
                value: elementName
            });

            return;
        }


        // ======================================
        // INPUT
        // ======================================

        if (action.type === "INPUT") {

            const value =
                (action.value || "").trim();

            if (!value) {
                return;
            }


            const field =
                getInputField(action);


            const lastAction =
                cleanActions[
                    cleanActions.length - 1
                ];


            if (
                lastAction &&
                lastAction.type === "INPUT" &&
                lastAction.field === field
            ) {

                lastAction.value =
                    value;

                return;
            }


            cleanActions.push({
                type: "INPUT",
                value: value,
                field: field
            });

            return;
        }


        // ======================================
        // OTHER ACTIONS
        // ======================================

        const elementName =
            getSmartActionName(action);

        if (
            !elementName ||
            isTechnicalElement(elementName)
        ) {
            return;
        }


        cleanActions.push({
            type:
                formatActionType(
                    action.type
                ),

            value:
                elementName
        });

    });


    // ==========================================
    // CONVERT TO HUMAN READABLE STEPS
    // ==========================================

    cleanActions.forEach((action) => {

        // CLICK

        if (action.type === "CLICK") {

            steps.push(
                `Click on "${action.value}"`
            );

            return;
        }


        // INPUT

        if (action.type === "INPUT") {

            steps.push(
                `Enter "${action.value}" in "${action.field}"`
            );

            return;
        }


        // OTHER

        steps.push(
            `${action.type} "${action.value}"`
        );

    });


    return steps;
}


// ==========================================
// SMART ACTION NAME
// ==========================================

function getSmartActionName(action) {

    if (!action) {
        return "";
    }


    const candidates = [

        action.element,
        action.ariaLabel,
        action.title,
        action.placeholder,
        action.innerText,
        action.textContent

    ];


    let name = "";


    for (const candidate of candidates) {

        if (!candidate) {
            continue;
        }


        const value =
            String(candidate)
                .trim()
                .replace(/\s+/g, " ");


        if (!value) {
            continue;
        }


        if (
            isTechnicalElement(value)
        ) {
            continue;
        }


        name = value;

        break;
    }


    if (!name) {
        return "";
    }


    name =
        simplifyElementText(name);


    if (!name) {
        return "";
    }


    if (
        isTechnicalElement(name)
    ) {
        return "";
    }


    return name.substring(0, 150);
}


// ==========================================
// SIMPLIFY ELEMENT TEXT
// ==========================================

function simplifyElementText(text) {

    if (!text) {
        return "";
    }


    let result =
        String(text)
            .trim()
            .replace(/\s+/g, " ");


    const lower =
        result.toLowerCase();


    if (
        lower.includes("add to cart")
    ) {
        return "Add to Cart";
    }


    if (
        lower.includes("add to compare")
    ) {
        return "Add to Compare";
    }


    if (
        lower.includes("buy now")
    ) {
        return "Buy Now";
    }


    if (
        lower === "remove" ||
        lower.includes("remove")
    ) {
        return "Remove";
    }


    if (
        lower === "continue" ||
        lower.includes("continue")
    ) {
        return "Continue";
    }


    if (
        lower === "submit" ||
        lower.includes("submit")
    ) {
        return "Submit";
    }


    if (
        lower.includes("search for products") ||
        lower.includes(
            "search for products, brands and more"
        )
    ) {
        return "Search";
    }


    if (
        lower.includes("checkout")
    ) {
        return "Checkout";
    }


    if (
        lower.includes("place order")
    ) {
        return "Place Order";
    }


    if (
        isTechnicalElement(result)
    ) {
        return "";
    }


    return result;
}


// ==========================================
// IGNORE TECHNICAL ELEMENTS
// ==========================================

function isTechnicalElement(name) {

    if (!name) {
        return true;
    }


    const value =
        String(name)
            .trim()
            .toLowerCase();


    const technicalElements = [

        "svg",
        "path",
        "div",
        "span",
        "img",
        "section",
        "article",
        "button",
        "input",
        "textarea",
        "select",
        "option",
        "unknown element"

    ];


    if (
        technicalElements.includes(value)
    ) {
        return true;
    }


    // CSS classes

    if (
        /^css-[a-z0-9_-]+$/i.test(value)
    ) {
        return true;
    }


    // Generated class values

    if (
        /^[a-zA-Z0-9_-]+$/.test(value) &&
        (
            value.includes("_") ||
            value.includes("-")
        ) &&
        value.length < 40
    ) {

        const meaningfulWords = [

            "search",
            "remove",
            "continue",
            "submit",
            "checkout",
            "cart",
            "product",
            "login",
            "logout",
            "cancel",
            "save",
            "update",
            "delete",
            "next",
            "previous",
            "back",
            "close"

        ];


        if (
            !meaningfulWords.includes(value)
        ) {
            return true;
        }
    }


    return false;
}


// ==========================================
// FORMAT ACTION TYPE
// ==========================================

function formatActionType(type) {

    if (!type) {
        return "Perform action on";
    }


    return type
        .toLowerCase()
        .replace(
            /^[a-z]/,
            (letter) =>
                letter.toUpperCase()
        );
}


// ==========================================
// BROWSER DETECTION
// ==========================================

function getBrowserInfo() {

    const userAgent =
        navigator.userAgent;


    let browser = "Unknown";
    let version = "Unknown";


    if (
        userAgent.includes("Edg/")
    ) {

        browser =
            "Microsoft Edge";

        version =
            userAgent.match(
                /Edg\/([\d.]+)/
            )?.[1] || "Unknown";

    }

    else if (
        userAgent.includes("Chrome/")
    ) {

        browser =
            "Google Chrome";

        version =
            userAgent.match(
                /Chrome\/([\d.]+)/
            )?.[1] || "Unknown";

    }

    else if (
        userAgent.includes("Firefox/")
    ) {

        browser =
            "Mozilla Firefox";

        version =
            userAgent.match(
                /Firefox\/([\d.]+)/
            )?.[1] || "Unknown";

    }

    else if (
        userAgent.includes("Safari/")
    ) {

        browser =
            "Safari";

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

if (copyJsonButton) {

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


                setTimeout(
                    () => {

                        copyJsonButton.textContent =
                            "📋 Copy Bug Data";

                    },
                    2000
                );

            } catch (err) {

                console.error(
                    "Copy failed:",
                    err
                );

                showError(
                    "Unable to copy bug data."
                );
            }
        }
    );
}


// ==========================================
// ERROR HANDLING
// ==========================================

function showError(message) {

    if (!error) {
        return;
    }


    error.textContent =
        message;

    error.classList.remove(
        "hidden"
    );
}


function hideError() {

    if (!error) {
        return;
    }


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
// GENERATE EXPECTED RESULT
// ==========================================

function generateExpectedResult(description) {

    expectedResultSource =
        "DEFAULT";


    if (
        !description ||
        !description.trim()
    ) {

        return "The functionality should work as per the defined requirements.";
    }


    const original =
        description.trim();

    const text =
        original.toLowerCase();


    // ==========================================
    // RULE 1 - NOT APPEARING / NOT VISIBLE
    // ==========================================

    if (

        text.includes("not appearing") ||
        text.includes("not visible") ||
        text.includes("not displayed") ||
        text.includes("not showing") ||
        text.includes("not shown") ||
        text.includes("missing")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        const subject =
            removeFailurePhrase(original);


        if (text.includes("under")) {

            const parts =
                subject.split(
                    /\s+under\s+/i
                );


            if (parts.length === 2) {

                return `${capitalize(parts[0])} should be displayed correctly under ${parts[1]}.`;
            }
        }


        return `${capitalize(subject)} should be displayed correctly to the user.`;
    }


    // ==========================================
    // RULE 2 - NOT WORKING
    // ==========================================

    if (

        text.includes("not working") ||
        text.includes("does not work") ||
        text.includes("not functioning") ||
        text.includes("not responding")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        const subject =
            removeFailurePhrase(original);


        return `${capitalize(subject)} should work correctly as per the expected functionality.`;
    }


    // ==========================================
    // RULE 3 - NOT SAVING
    // ==========================================

    if (

        text.includes("not saving") ||
        text.includes("does not save") ||
        text.includes("not saved") ||
        text.includes("unable to save")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        const subject =
            removeFailurePhrase(original);


        return `${capitalize(subject)} should be saved successfully.`;
    }


    // ==========================================
    // RULE 4 - NOT LOADING
    // ==========================================

    if (

        text.includes("not loading") ||
        text.includes("does not load") ||
        text.includes("failed to load")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        const subject =
            removeFailurePhrase(original);


        return `${capitalize(subject)} should load successfully without any error.`;
    }


    // ==========================================
    // RULE 5 - WRONG DATA
    // ==========================================

    if (

        text.includes("wrong data") ||
        text.includes("incorrect data") ||
        text.includes("wrong value") ||
        text.includes("incorrect value") ||
        text.includes("invalid data")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "The system should display the correct data as per the defined requirements.";
    }


    // ==========================================
    // RULE 6 - DUPLICATE
    // ==========================================

    if (

        text.includes("duplicate") ||
        text.includes("duplicated")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "Duplicate records or elements should not be created or displayed.";
    }


    // ==========================================
    // RULE 7 - ERROR
    // ==========================================

    if (

        text.includes("error") ||
        text.includes("exception") ||
        text.includes("failed")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "The operation should complete successfully without displaying any unexpected error.";
    }


    // ==========================================
    // RULE 8 - CRASH
    // ==========================================

    if (

        text.includes("crash") ||
        text.includes("crashed")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "The application should remain stable and should not crash.";
    }


    // ==========================================
    // RULE 9 - FREEZE
    // ==========================================

    if (

        text.includes("freeze") ||
        text.includes("frozen")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "The application should remain responsive and allow the user to continue the intended operation.";
    }


    // ==========================================
    // RULE 10 - PERFORMANCE
    // ==========================================

    if (

        text.includes("slow") ||
        text.includes("taking too long") ||
        text.includes("timeout") ||
        text.includes("performance issue")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "The operation should complete within the expected response time without performance issues.";
    }


    // ==========================================
    // RULE 11 - WRONG COUNT
    // ==========================================

    if (

        text.includes("wrong count") ||
        text.includes("incorrect count") ||
        text.includes("count mismatch")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "The system should display the correct count according to the available records and applied filters.";
    }


    // ==========================================
    // RULE 12 - PAGINATION
    // ==========================================

    if (

        text.includes("pagination") ||
        text.includes("next page") ||
        text.includes("previous page")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "Pagination should work correctly and display the appropriate records for the selected page.";
    }


    // ==========================================
    // RULE 13 - LOGIN
    // ==========================================

    if (

        text.includes("login failed") ||
        text.includes("unable to login") ||
        text.includes("cannot login") ||
        text.includes("login not working")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "The user should be able to log in successfully with valid credentials.";
    }


    // ==========================================
    // RULE 14 - SEARCH
    // ==========================================

    if (

        text.includes("search not working") ||
        text.includes("search does not work") ||
        text.includes("unable to search")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "The search functionality should return the relevant results based on the entered search criteria.";
    }


    // ==========================================
    // RULE 15 - FILTER
    // ==========================================

    if (

        text.includes("filter not working") ||
        text.includes("filter does not work") ||
        text.includes("filter issue")

    ) {

        expectedResultSource =
            "RULE_ENGINE";


        return "The selected filter should be applied correctly and only matching records should be displayed.";
    }


    // ==========================================
    // AI FALLBACK
    // ==========================================

    return generateExpectedResultWithAIFallback(
        original
    );
}


// ==========================================
// REMOVE FAILURE PHRASE
// ==========================================

function removeFailurePhrase(text) {

    if (!text) {
        return "The affected functionality";
    }


    return text

        .replace(
            /\s+is\s+not\s+appearing\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+visible\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+displayed\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+showing\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+shown\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+missing\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+working\.?$/i,
            ""
        )

        .replace(
            /\s+does\s+not\s+work\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+functioning\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+responding\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+saving\.?$/i,
            ""
        )

        .replace(
            /\s+does\s+not\s+save\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+saved\.?$/i,
            ""
        )

        .replace(
            /\s+is\s+not\s+loading\.?$/i,
            ""
        )

        .replace(
            /\s+does\s+not\s+load\.?$/i,
            ""
        )

        .trim();
}


// ==========================================
// AI FALLBACK
// ==========================================

function generateExpectedResultWithAIFallback(
    description
) {

    expectedResultSource =
        "AI_FALLBACK";


    if (!description) {

        expectedResultSource =
            "DEFAULT";

        return "The functionality should work as per the defined requirements.";
    }


    const text =
        description.toLowerCase();


    // ==========================================
    // NOT AVAILABLE
    // ==========================================

    if (

        text.includes("not available") ||
        text.includes("unavailable")

    ) {

        const subject =
            removeFailurePhrase(
                description
            );


        return `${capitalize(subject)} should be available to the user when the applicable conditions are met.`;
    }


    // ==========================================
    // DISPLAY
    // ==========================================

    if (

        text.includes("display") ||
        text.includes("shown") ||
        text.includes("visible")

    ) {

        return "The relevant information should be displayed correctly and clearly to the user.";
    }


    // ==========================================
    // DATA
    // ==========================================

    if (

        text.includes("data") ||
        text.includes("record") ||
        text.includes("value")

    ) {

        return "The system should display and process the correct data according to the defined business requirements.";
    }


    // ==========================================
    // DEFAULT
    // ==========================================

    return "The reported functionality should behave correctly according to the defined business requirements.";
}


// ==========================================
// CAPITALIZE
// ==========================================

function capitalize(text) {

    if (!text) {
        return "The affected functionality";
    }


    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}


// ==========================================
// GET LATEST BUG VIDEO
// ==========================================

function getLatestBugVideo() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    "AIBugReporterDB",
                    1
                );


            request.onerror = () => {

                reject(
                    request.error
                );
            };


            request.onsuccess = () => {

                const db =
                    request.result;


                // Check whether videos store exists

                if (
                    !db.objectStoreNames.contains(
                        "videos"
                    )
                ) {

                    db.close();

                    resolve(null);

                    return;
                }


                try {

                    const transaction =
                        db.transaction(
                            "videos",
                            "readonly"
                        );


                    const store =
                        transaction.objectStore(
                            "videos"
                        );


                    const getRequest =
                        store.get(
                            "latestBugVideo"
                        );


                    getRequest.onsuccess = () => {

                        const videoResult =
                            getRequest.result;


                        db.close();


                        if (
                            videoResult &&
                            videoResult.blob
                        ) {

                            resolve(
                                videoResult.blob
                            );

                        } else {

                            resolve(null);
                        }
                    };


                    getRequest.onerror = () => {

                        db.close();

                        reject(
                            getRequest.error
                        );
                    };

                } catch (err) {

                    db.close();

                    reject(err);
                }
            };
        }
    );
}