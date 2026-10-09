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

const copyScreenshotButton =
document.getElementById("copyScreenshot");

const downloadScreenshotButton =
document.getElementById("downloadScreenshot");

const downloadVideoButton =
document.getElementById("downloadVideo");

const expectedResultInput =
document.getElementById("expectedResultInput");

const saveExpectedResultButton =
document.getElementById("saveExpectedResult");

const expectedResultSaved =
document.getElementById("expectedResultSaved");

let bugData = null;

let expectedResultSource =
"DEFAULT";

// ==========================================
// RESTORE RECORDING STATE
// ==========================================

async function restoreRecordingState() {

try {

    const storage =
        await chrome.storage.local.get([
            "captureActive",
            "userActions",
            "videoRecordingActive",
            "videoRecordingError"
        ]);

    const captureActive =
        storage.captureActive === true;

    const actions =
        Array.isArray(storage.userActions)
            ? storage.userActions
            : [];

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

} catch (err) {

    console.error(
        "Unable to restore recording state:",
        err
    );

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

        hideError();

        await chrome.storage.local.set({

            userActions: [],

            captureActive: true,

            videoRecordingActive: false,

            videoRecordingError: "",

            contentScriptReady: false

        });

        startCaptureButton.disabled = true;

        stopCaptureButton.disabled = false;

        reportBugButton.disabled = true;

        startCaptureButton.textContent =
            "🔴 Recording...";


        try {

            const response =
                await chrome.runtime.sendMessage({

                    type: "START_VIDEO"

                });

            console.log(
                "START_VIDEO response:",
                response
            );

            if (
                response &&
                response.contentScriptReady === false
            ) {

                console.warn(
                    "Action recording could not be attached to this page."
                );
            }

            if (
                response &&
                response.video &&
                response.video.success !== true
            ) {

                console.warn(
                    "Video recording unavailable:",
                    response.video.message
                );
            }

        } catch (videoError) {

            console.warn(
                "Video/action initialization warning:",
                videoError
            );
        }


        console.log(
            "Recording started."
        );

        window.close();

    } catch (err) {

        console.error(
            "Start recording failed:",
            err
        );

        try {

            await chrome.storage.local.set({

                captureActive: false,

                videoRecordingActive: false

            });

        } catch (storageError) {

            console.warn(
                "Unable to reset recording state:",
                storageError
            );
        }

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

        hideError();

        await chrome.storage.local.set({

            captureActive: false

        });


        const storage =
            await chrome.storage.local.get([
                "userActions"
            ]);

        const actions =
            Array.isArray(storage.userActions)
                ? storage.userActions
                : [];

        console.log(
            "Captured actions:",
            actions
        );


        try {

            const response =
                await chrome.runtime.sendMessage({

                    type: "STOP_VIDEO"

                });

            console.log(
                "STOP_VIDEO response:",
                response
            );

        } catch (videoError) {

            console.warn(
                "Unable to stop video:",
                videoError
            );
        }


        startCaptureButton.disabled = false;

        stopCaptureButton.disabled = true;

        reportBugButton.disabled =
            actions.length === 0;

        startCaptureButton.textContent =
            "▶️ Start Recording";


        console.log(
            "Recording stopped."
        );

    } catch (err) {

        console.error(
            "Stop recording failed:",
            err
        );

        try {

            await chrome.storage.local.set({

                captureActive: false

            });

        } catch (storageError) {

            console.warn(
                storageError
            );
        }

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

        bugData = null;


        const description =
            descriptionInput.value.trim();


        if (!description) {

            showError(
                "Please describe the bug first."
            );

            return;
        }


        loading.classList.remove("hidden");

        result.classList.add("hidden");

        reportBugButton.disabled = true;


        // ----------------------------------
        // GET ACTIVE TAB
        // ----------------------------------

        const tabs =
            await chrome.tabs.query({

                active: true,

                currentWindow: true

            });


        if (
            !tabs ||
            tabs.length === 0
        ) {

            throw new Error(
                "Active tab could not be found."
            );
        }


        const tab = tabs[0];


        // ----------------------------------
        // SCREENSHOT
        // ----------------------------------

        let screenshot = "";


        try {

            screenshot =
                await chrome.tabs.captureVisibleTab(
                    null,
                    {
                        format: "png"
                    }
                );

        } catch (screenshotError) {

            console.warn(
                "Screenshot capture failed:",
                screenshotError
            );
        }


        // ----------------------------------
        // VIDEO
        // ----------------------------------

        let savedVideo = null;


        try {

            savedVideo =
                await waitForLatestBugVideo(
                    2500,
                    250
                );

        } catch (videoError) {

            console.warn(
                "Unable to retrieve video:",
                videoError
            );
        }


        // ----------------------------------
        // BROWSER INFO
        // ----------------------------------

        const browserInfo =
            getBrowserInfo();


        // ----------------------------------
        // USER ACTIONS
        // ----------------------------------

        const actionData =
            await chrome.storage.local.get([
                "userActions"
            ]);


        const userActions =
            Array.isArray(
                actionData.userActions
            )
                ? actionData.userActions
                : [];


        console.log(
            "Captured user actions:",
            userActions
        );


        // ----------------------------------
        // CLEAN ACTIONS
        // ----------------------------------

        const cleanUserActions =
            generateUserActions(
                userActions
            );


        // ----------------------------------
        // STEPS
        // ----------------------------------

        const generatedSteps =
            generateSteps(
                userActions
            );


        // ----------------------------------
        // EXPECTED RESULT
        // ----------------------------------

        const generatedExpectedResult =
            generateExpectedResult(
                description
            );


        console.log(
            "Generated Expected Result:",
            generatedExpectedResult
        );

        console.log(
            "Expected Result Source:",
            expectedResultSource
        );


        // ----------------------------------
        // CREATE BUG DATA
        // ----------------------------------

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

            stepsToReproduce:
                generatedSteps,

            actualResult:
                description,

            expectedResult:
                generatedExpectedResult,

            expectedResultSource:
                expectedResultSource,

            userActions:
                cleanUserActions,

            screenshot:
                screenshot,

            video: {

                available:
                    !!savedVideo

            }

        };


        // ----------------------------------
        // STOP RECORDING STATE
        // ----------------------------------

        await chrome.storage.local.set({

            captureActive: false

        });


        // ----------------------------------
        // SAVE BUG
        // ----------------------------------

        await chrome.storage.local.set({

            lastBugReport:
                bugData

        });


        // ----------------------------------
        // UPDATE UI
        // ----------------------------------

        startCaptureButton.disabled = false;

        stopCaptureButton.disabled = true;

        reportBugButton.disabled = true;

        startCaptureButton.textContent =
            "▶️ Start Recording";


        // ----------------------------------
        // DISPLAY
        // ----------------------------------

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


        if (!bugData) {

            try {

                const storage =
                    await chrome.storage.local.get([
                        "userActions"
                    ]);

                const actions =
                    Array.isArray(
                        storage.userActions
                    )
                        ? storage.userActions
                        : [];

                reportBugButton.disabled =
                    actions.length === 0;

            } catch (storageError) {

                reportBugButton.disabled = true;
            }
        }
    }
}

);

// ==========================================
// DISPLAY BUG DATA
// ==========================================

async function displayBugData(
data
) {

// --------------------------------------
// EXPECTED RESULT INPUT
// --------------------------------------

if (expectedResultInput) {

    expectedResultInput.value =
        data.expectedResult || "";
}


// --------------------------------------
// EXPECTED RESULT SOURCE
// --------------------------------------

const sourceElement =
    document.getElementById(
        "expectedResultSource"
    );


if (sourceElement) {

    if (
        data.expectedResultSource ===
        "AI_FALLBACK"
    ) {

        sourceElement.textContent =
            "🤖 Generated using AI Fallback";

    } else if (
        data.expectedResultSource ===
        "RULE_ENGINE"
    ) {

        sourceElement.textContent =
            "⚙️ Generated using Rule Engine";

    } else if (
        data.expectedResultSource ===
        "MANUAL"
    ) {

        sourceElement.textContent =
            "✏️ Manually edited";

    } else {

        sourceElement.textContent =
            "Generated automatically";
    }
}


// --------------------------------------
// URL
// --------------------------------------

setText(
    "resultUrl",
    data.url
);


// --------------------------------------
// PAGE TITLE
// --------------------------------------

setText(
    "resultTitle",
    data.pageTitle
);


// --------------------------------------
// BROWSER
// --------------------------------------

setText(
    "resultBrowser",
    `${data.browser || ""} ${data.browserVersion || ""}`.trim()
);


// --------------------------------------
// TIME
// --------------------------------------

setText(
    "resultTime",
    data.capturedAt
);


// --------------------------------------
// STEPS
// --------------------------------------

const stepsContainer =
    document.getElementById(
        "stepsToReproduce"
    );


if (stepsContainer) {

    stepsContainer.innerHTML = "";


    if (
        Array.isArray(
            data.stepsToReproduce
        ) &&
        data.stepsToReproduce.length
    ) {

        data.stepsToReproduce.forEach(
            (step, index) => {

                const element =
                    document.createElement(
                        "p"
                    );

                element.textContent =
                    `${index + 1}. ${step}`;

                stepsContainer.appendChild(
                    element
                );
            }
        );

    } else {

        stepsContainer.textContent =
            "No steps captured.";
    }
}


// --------------------------------------
// ACTUAL RESULT
// --------------------------------------

setText(
    "actualResult",
    data.actualResult
);


// --------------------------------------
// EXPECTED RESULT
// --------------------------------------

setText(
    "expectedResult",
    data.expectedResult
);


// --------------------------------------
// USER ACTIONS
// --------------------------------------

const userActionsContainer =
    document.getElementById(
        "userActions"
    );


if (userActionsContainer) {

    userActionsContainer.innerHTML = "";


    if (
        Array.isArray(
            data.userActions
        ) &&
        data.userActions.length
    ) {

        data.userActions.forEach(
            (action, index) => {

                const element =
                    document.createElement(
                        "p"
                    );

                element.textContent =
                    `${index + 1}. ${action.type} → ${action.value}`;

                userActionsContainer.appendChild(
                    element
                );
            }
        );

    } else {

        userActionsContainer.textContent =
            "No user actions captured.";
    }
}


// --------------------------------------
// SCREENSHOT
// --------------------------------------

const screenshotElement =
    document.getElementById(
        "screenshot"
    );


if (screenshotElement) {

    screenshotElement.src =
        data.screenshot || "";
}


const screenshotButtons =
    document.getElementById(
        "screenshotButtons"
    );


if (screenshotButtons) {

    screenshotButtons.classList.toggle(
        "hidden",
        !data.screenshot
    );
}


// --------------------------------------
// VIDEO
// --------------------------------------

const bugVideo =
    document.getElementById(
        "bugVideo"
    );

const videoStatus =
    document.getElementById(
        "videoStatus"
    );

const videoButtons =
    document.getElementById(
        "videoButtons"
    );


if (videoButtons) {

    videoButtons.classList.add(
        "hidden"
    );
}


if (bugVideo) {

    bugVideo.removeAttribute(
        "src"
    );
}


if (
    data.video &&
    data.video.available === true &&
    videoStatus
) {

    try {

        const videoData =
            await getLatestBugVideo();


        if (videoData) {

            const videoUrl =
                URL.createObjectURL(
                    videoData
                );


            bugVideo.src =
                videoUrl;


            videoStatus.textContent =
                "✅ Bug video recorded successfully.";


            if (videoButtons) {

                videoButtons.classList.remove(
                    "hidden"
                );
            }

        } else {

            videoStatus.textContent =
                "⚠️ Video not found.";
        }

    } catch (videoError) {

        console.warn(
            "Unable to load video:",
            videoError
        );

        videoStatus.textContent =
            "⚠️ Unable to load video.";
    }

} else if (videoStatus) {

    videoStatus.textContent =
        "No video available.";
}


result.classList.remove("hidden");

}

// ==========================================
// SAVE EXPECTED RESULT
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


            bugData.expectedResult =
                editedExpectedResult;

            bugData.expectedResultSource =
                "MANUAL";

            expectedResultSource =
                "MANUAL";


            setText(
                "expectedResult",
                editedExpectedResult
            );


            await chrome.storage.local.set({

                lastBugReport:
                    bugData

            });


            const sourceElement =
                document.getElementById(
                    "expectedResultSource"
                );


            if (sourceElement) {

                sourceElement.textContent =
                    "✏️ Manually edited";
            }


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
// GENERATE USER ACTIONS
// ==========================================

function generateUserActions(
actions
) {

if (
    !Array.isArray(actions) ||
    actions.length === 0
) {

    return [];
}


const cleanActions = [];


actions.forEach(
    (action) => {

        if (
            !action ||
            !action.type
        ) {
            return;
        }


        if (
            action.type === "CLICK"
        ) {

            const name =
                getSmartActionName(
                    action
                );


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


        if (
            action.type === "INPUT"
        ) {

            const value =
                String(
                    action.value || ""
                ).trim();


            if (!value) {
                return;
            }


            const field =
                getInputField(
                    action
                );


            const last =
                cleanActions[
                    cleanActions.length - 1
                ];


            if (
                last &&
                last.type === "INPUT" &&
                last.field === field
            ) {

                last.value =
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


        const name =
            getSmartActionName(
                action
            );


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

            value: name

        });
    }
);


return cleanActions.map(
    (action) => ({

        type: action.type,

        value: action.value

    })
);

}

// ==========================================
// GET INPUT FIELD
// ==========================================

function getInputField(
action
) {

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
    .replace(
        /\s+/g,
        " "
    );

}

// ==========================================
// GENERATE STEPS
// ==========================================

function generateSteps(
actions
) {

const cleanActions =
    generateUserActionsWithFields(
        actions
    );


return cleanActions.map(
    (action) => {

        if (
            action.type === "CLICK"
        ) {

            return `Click on "${action.value}"`;
        }


        if (
            action.type === "INPUT"
        ) {

            return `Enter "${action.value}" in "${action.field}"`;
        }


        if (
            action.type === "SELECT"
        ) {

            return `Select "${action.value}" from "${action.field}"`;
        }


        return `${action.type} "${action.value}"`;
    }
);

}

// ==========================================
// INTERNAL CLEAN ACTIONS
// ==========================================

function generateUserActionsWithFields(
actions
) {

if (!Array.isArray(actions)) {
    return [];
}


const cleanActions = [];


actions.forEach(
    (action) => {

        if (
            !action ||
            !action.type
        ) {
            return;
        }


        if (
            action.type === "CLICK"
        ) {

            const name =
                getSmartActionName(
                    action
                );


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


        if (
            action.type === "INPUT"
        ) {

            const value =
                String(
                    action.value || ""
                ).trim();


            if (!value) {
                return;
            }


            const field =
                getInputField(
                    action
                );


            const last =
                cleanActions[
                    cleanActions.length - 1
                ];


            if (
                last &&
                last.type === "INPUT" &&
                last.field === field
            ) {

                last.value =
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


        const name =
            getSmartActionName(
                action
            );


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

            value: name,

            field:
                getInputField(
                    action
                )

        });
    }
);


return cleanActions;

}

// ==========================================
// SMART ACTION NAME
// ==========================================

function getSmartActionName(
action
) {

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


for (
    const candidate of candidates
) {

    if (!candidate) {
        continue;
    }


    const value =
        String(candidate)
            .trim()
            .replace(
                /\s+/g,
                " "
            );


    if (!value) {
        continue;
    }


    if (
        isTechnicalElement(value)
    ) {
        continue;
    }


    name =
        value;

    break;
}


if (!name) {
    return "";
}


name =
    simplifyElementText(
        name
    );


if (
    !name ||
    isTechnicalElement(name)
) {

    return "";
}


return name.substring(
    0,
    150
);

}

// ==========================================
// SIMPLIFY ELEMENT TEXT
// ==========================================

function simplifyElementText(
text
) {

if (!text) {
    return "";
}


const result =
    String(text)
        .trim()
        .replace(
            /\s+/g,
            " "
        );


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


return result;

}

// ==========================================
// TECHNICAL ELEMENT FILTER
// ==========================================

function isTechnicalElement(
name
) {

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


if (
    /^css-[a-z0-9_-]+$/i.test(value)
) {

    return true;
}


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

function formatActionType(
type
) {

if (!type) {
    return "Action";
}


return String(type)
    .toLowerCase()
    .replace(
        /^[a-z]/,
        (letter) =>
            letter.toUpperCase()
    );

}

// ==========================================
// BROWSER INFO
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
        )?.[1] ||
        "Unknown";

} else if (
    userAgent.includes("Chrome/")
) {

    browser =
        "Google Chrome";

    version =
        userAgent.match(
            /Chrome\/([\d.]+)/
        )?.[1] ||
        "Unknown";

} else if (
    userAgent.includes("Firefox/")
) {

    browser =
        "Mozilla Firefox";

    version =
        userAgent.match(
            /Firefox\/([\d.]+)/
        )?.[1] ||
        "Unknown";

} else if (
    userAgent.includes("Safari/")
) {

    browser =
        "Safari";

    version =
        userAgent.match(
            /Version\/([\d.]+)/
        )?.[1] ||
        "Unknown";
}


return {
    browser,
    version
};

}

// ==========================================
// BUG TITLE
// ==========================================

function generateBugTitle(
description
) {

if (!description) {
    return "Bug Report";
}


return description
    .trim()
    .replace(
        /\.$/,
        ""
    );

}

// ==========================================
// EXPECTED RESULT ENGINE
// ==========================================

function generateExpectedResult(
description
) {

expectedResultSource =
    "RULE_ENGINE";


if (
    !description ||
    !description.trim()
) {

    expectedResultSource =
        "DEFAULT";

    return (
        "The affected functionality should work as expected."
    );
}


const original =
    description
        .trim()
        .replace(
            /\s+/g,
            " "
        );


const text =
    original.toLowerCase();


// ======================================
// DISPLAY / NOT APPEARING
// ======================================

if (
    matchesAny(
        text,
        [
            "not appearing",
            "not appear",
            "not visible",
            "not displayed",
            "not showing",
            "not shown",
            "missing",
            "is hidden",
            "not available"
        ]
    )
) {

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should be displayed and visible to the user.`
    );
}


// ======================================
// NOT CLICKABLE
// ======================================

if (
    matchesAny(
        text,
        [
            "not clickable",
            "cannot click",
            "can't click",
            "unable to click",
            "click is not working",
            "click does not work"
        ]
    )
) {

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should be clickable and should respond correctly when clicked.`
    );
}


// ======================================
// DISABLED
// ======================================

if (
    matchesAny(
        text,
        [
            "is disabled",
            "button is disabled",
            "remains disabled",
            "not enabled",
            "cannot be enabled"
        ]
    )
) {

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should be enabled when the applicable conditions are met.`
    );
}


// ======================================
// NOT SAVING
// ======================================

if (
    matchesAny(
        text,
        [
            "not saving",
            "does not save",
            "not saved",
            "unable to save",
            "save is not working",
            "save button is not working"
        ]
    )
) {

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should be saved successfully without losing the entered data.`
    );
}


// ======================================
// NOT LOADING
// ======================================

if (
    matchesAny(
        text,
        [
            "not loading",
            "does not load",
            "failed to load",
            "unable to load"
        ]
    )
) {

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should load successfully without any unexpected error.`
    );
}


// ======================================
// WRONG COUNT
// ======================================

if (
    matchesAny(
        text,
        [
            "wrong count",
            "incorrect count",
            "count mismatch",
            "count is incorrect",
            "count is wrong"
        ]
    )
) {

    return (
        "The system should display the correct count based on the available records and applied filters."
    );
}


// ======================================
// MORE THAN LIMIT
// ======================================

const moreThanMatch =
    text.match(
        /(?:more than|greater than|exceeding|exceeds|above)\s+(\d+)/
    );


if (moreThanMatch) {

    const limit =
        moreThanMatch[1];

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should not allow a value greater than ${limit}.`
    );
}


// ======================================
// LESS THAN LIMIT
// ======================================

const lessThanMatch =
    text.match(
        /(?:less than|below|lower than)\s+(\d+)/
    );


if (lessThanMatch) {

    const limit =
        lessThanMatch[1];

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should not allow a value less than ${limit}.`
    );
}


// ======================================
// MAXIMUM LIMIT
// ======================================

const maxMatch =
    text.match(
        /(?:maximum|max)\s+(?:of\s+)?(\d+)/
    );


if (maxMatch) {

    const limit =
        maxMatch[1];

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should allow a maximum of ${limit}.`
    );
}


// ======================================
// MINIMUM LIMIT
// ======================================

const minMatch =
    text.match(
        /(?:minimum|min)\s+(?:of\s+)?(\d+)/
    );


if (minMatch) {

    const limit =
        minMatch[1];

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should allow a minimum of ${limit}.`
    );
}


// ======================================
// BLANK / EMPTY
// ======================================

if (
    matchesAny(
        text,
        [
            "is blank",
            "blank",
            "is empty",
            "empty field",
            "appearing blank",
            "displaying blank"
        ]
    )
) {

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should display the expected value or information and should not remain blank.`
    );
}


// ======================================
// WRONG / INCORRECT DATA
// ======================================

if (
    matchesAny(
        text,
        [
            "wrong data",
            "incorrect data",
            "wrong value",
            "incorrect value",
            "wrong details",
            "incorrect details",
            "wrong information",
            "incorrect information",
            "data mismatch",
            "value mismatch"
        ]
    )
) {

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should display the correct data as defined in the business requirements.`
    );
}


// ======================================
// DUPLICATE
// ======================================

if (
    matchesAny(
        text,
        [
            "duplicate",
            "duplicated",
            "duplicate record",
            "duplicate records",
            "duplicate entry",
            "duplicate entries"
        ]
    )
) {

    return (
        "Duplicate records or entries should not be created or displayed."
    );
}


// ======================================
// SEARCH
// ======================================

if (
    text.includes("search")
) {

    if (
        matchesAny(
            text,
            [
                "not working",
                "does not work",
                "unable",
                "not returning",
                "no result"
            ]
        )
    ) {

        return (
            "The search functionality should return the relevant records matching the entered search criteria."
        );
    }

    return (
        "The search functionality should work correctly and return relevant results based on the entered search criteria."
    );
}


// ======================================
// FILTER
// ======================================

if (
    text.includes("filter")
) {

    return (
        "The selected filter should be applied correctly and only matching records should be displayed."
    );
}


// ======================================
// PAGINATION
// ======================================

if (
    text.includes("pagination") ||
    text.includes("next page") ||
    text.includes("previous page") ||
    text.includes("page navigation")
) {

    return (
        "Pagination should work correctly and display the appropriate records for the selected page."
    );
}


// ======================================
// CHECKBOX
// ======================================

if (
    text.includes("checkbox")
) {

    if (
        matchesAny(
            text,
            [
                "not selected",
                "cannot select",
                "unable to select"
            ]
        )
    ) {

        return (
            "The checkbox should be selectable and should correctly reflect the selected state."
        );
    }

    return (
        "The checkbox should correctly reflect the user's selection."
    );
}


// ======================================
// RADIO BUTTON
// ======================================

if (
    text.includes("radio button") ||
    text.includes("radio")
) {

    return (
        "The radio button should be selectable and should correctly reflect the selected option."
    );
}


// ======================================
// DROPDOWN
// ======================================

if (
    text.includes("dropdown") ||
    text.includes("drop-down")
) {

    if (
        matchesAny(
            text,
            [
                "not opening",
                "not working",
                "unable to select"
            ]
        )
    ) {

        return (
            "The dropdown should open correctly and allow the user to select the required option."
        );
    }

    return (
        "The dropdown should display the available options and allow the user to select the required value."
    );
}


// ======================================
// POPUP / MODAL
// ======================================

if (
    text.includes("popup") ||
    text.includes("pop-up") ||
    text.includes("modal")
) {

    if (
        matchesAny(
            text,
            [
                "not opening",
                "not appearing",
                "not displayed"
            ]
        )
    ) {

        return (
            "The popup should open and display the expected information and controls correctly."
        );
    }


    if (
        matchesAny(
            text,
            [
                "not closing",
                "cannot close",
                "unable to close"
            ]
        )
    ) {

        return (
            "The popup should close successfully when the user clicks the Close or Cancel option."
        );
    }


    return (
        "The popup should behave correctly and display the expected information and controls."
    );
}


// ======================================
// API / UI DATA
// ======================================

if (
    text.includes("api")
) {

    if (
        matchesAny(
            text,
            [
                "not displayed",
                "not showing",
                "missing",
                "not appearing"
            ]
        )
    ) {

        return (
            "The data received from the API should be correctly displayed in the UI."
        );
    }


    if (
        matchesAny(
            text,
            [
                "wrong",
                "incorrect",
                "mismatch"
            ]
        )
    ) {

        return (
            "The UI should display data consistent with the API response."
        );
    }


    return (
        "The API request should complete successfully and the response data should be processed correctly."
    );
}


// ======================================
// AUTO SELECT / AUTO POPULATE
// ======================================

if (
    matchesAny(
        text,
        [
            "auto select",
            "auto-select",
            "automatically selected",
            "not automatically selected",
            "autopopulate",
            "auto populate",
            "not auto populated",
            "not automatically populated"
        ]
    )
) {

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should be automatically selected or populated based on the applicable conditions.`
    );
}


// ======================================
// RESET
// ======================================

if (
    text.includes("reset")
) {

    return (
        "The selected fields or values should reset correctly to their default state."
    );
}


// ======================================
// LOGIN
// ======================================

if (
    text.includes("login")
) {

    if (
        matchesAny(
            text,
            [
                "failed",
                "not working",
                "unable",
                "cannot"
            ]
        )
    ) {

        return (
            "The user should be able to log in successfully with valid credentials."
        );
    }

    return (
        "The login functionality should work correctly and authenticate the user with valid credentials."
    );
}


// ======================================
// ERROR / EXCEPTION
// ======================================

if (
    text.includes("error") ||
    text.includes("exception")
) {

    return (
        "The operation should complete successfully without displaying any unexpected error or exception."
    );
}


// ======================================
// CRASH
// ======================================

if (
    text.includes("crash") ||
    text.includes("crashed")
) {

    return (
        "The application should remain stable and should not crash during the operation."
    );
}


// ======================================
// FREEZE
// ======================================

if (
    text.includes("freeze") ||
    text.includes("frozen")
) {

    return (
        "The application should remain responsive and allow the user to continue the intended operation."
    );
}


// ======================================
// PERFORMANCE
// ======================================

if (
    text.includes("slow") ||
    text.includes("performance") ||
    text.includes("taking too long") ||
    text.includes("timeout")
) {

    return (
        "The operation should complete within the expected response time without performance issues."
    );
}


// ======================================
// NOT FOUND
// ======================================

if (
    matchesAny(
        text,
        [
            "not found",
            "cannot find",
            "unable to find"
        ]
    )
) {

    const subject =
        extractAffectedSubject(
            original
        );

    return (
        `${capitalize(subject)} should be available and should be found when searched using valid criteria.`
    );
}


// ======================================
// GENERIC DESCRIPTION-SPECIFIC RESULT
// ======================================

const subject =
    extractAffectedSubject(
        original
    );


if (
    subject &&
    subject !== "the affected functionality"
) {

    return (
        `${capitalize(subject)} should behave correctly according to the expected business functionality.`
    );
}


// ======================================
// FINAL FALLBACK
// ======================================

expectedResultSource =
    "AI_FALLBACK";


return (
    "The reported functionality should behave correctly according to the defined business requirements."
);

}

// ==========================================
// MATCH ANY
// ==========================================

function matchesAny(
text,
phrases
) {

if (
    !text ||
    !Array.isArray(phrases)
) {

    return false;
}


return phrases.some(
    phrase =>
        text.includes(
            phrase.toLowerCase()
        )
);

}

// ==========================================
// EXTRACT AFFECTED SUBJECT
// ==========================================

function extractAffectedSubject(
description
) {

if (!description) {

    return (
        "the affected functionality"
    );
}


let subject =
    description
        .trim()
        .replace(
            /\.$/,
            ""
        );


// --------------------------------------
// Remove module prefix
// --------------------------------------

subject =
    subject.replace(
        /^(pre-adt|ip billing|dashboard|module)\s*>\s*/i,
        ""
    );


// --------------------------------------
// Remove common prefixes
// --------------------------------------

subject =
    subject.replace(
        /^(when|if|while)\s+/i,
        ""
    );


subject =
    subject.replace(
        /^(user|the user)\s+/i,
        ""
    );


subject =
    subject.replace(
        /^(issue with|issue in|problem with|problem in|bug in)\s+/i,
        ""
    );


// --------------------------------------
// Remove failure phrases
// --------------------------------------

const failurePatterns = [

    /\s+is\s+not\s+appearing$/i,

    /\s+is\s+not\s+visible$/i,

    /\s+is\s+not\s+displayed$/i,

    /\s+is\s+not\s+showing$/i,

    /\s+is\s+not\s+shown$/i,

    /\s+is\s+missing$/i,

    /\s+is\s+hidden$/i,

    /\s+is\s+not\s+working$/i,

    /\s+does\s+not\s+work$/i,

    /\s+doesn't\s+work$/i,

    /\s+is\s+not\s+functioning$/i,

    /\s+is\s+not\s+responding$/i,

    /\s+is\s+not\s+saving$/i,

    /\s+does\s+not\s+save$/i,

    /\s+is\s+not\s+saved$/i,

    /\s+is\s+not\s+loading$/i,

    /\s+does\s+not\s+load$/i,

    /\s+is\s+disabled$/i,

    /\s+is\s+blank$/i,

    /\s+is\s+empty$/i,

    /\s+is\s+wrong$/i,

    /\s+is\s+incorrect$/i,

    /\s+is\s+not\s+clickable$/i,

    /\s+cannot\s+be\s+clicked$/i,

    /\s+not\s+found$/i,

    /\s+cannot\s+find$/i,

    /\s+is\s+duplicated$/i
];


failurePatterns.forEach(
    pattern => {

        subject =
            subject.replace(
                pattern,
                ""
            );
    }
);


// --------------------------------------
// Remove common trailing bug phrases
// --------------------------------------

subject =
    subject
        .replace(
            /\s+is\s+not\s+available$/i,
            ""
        )
        .replace(
            /\s+is\s+not\s+enabled$/i,
            ""
        )
        .replace(
            /\s+not\s+working$/i,
            ""
        )
        .replace(
            /\s+not\s+appearing$/i,
            ""
        )
        .replace(
            /\s+not\s+displayed$/i,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();


// --------------------------------------
// If subject still contains "Pre-ADT >"
// remove remaining module path
// --------------------------------------

const parts =
    subject
        .split(">")
        .map(
            item =>
                item.trim()
        )
        .filter(Boolean);


if (parts.length > 0) {

    // Use the most relevant final section.
    // Example:
    // Pre-ADT > Settlement Screen > Partial Bill Settlement
    // becomes Partial Bill Settlement

    subject =
        parts[parts.length - 1];
}


// --------------------------------------
// Remove trailing punctuation
// --------------------------------------

subject =
    subject
        .replace(
            /[.!?]+$/,
            ""
        )
        .trim();


// --------------------------------------
// Limit length
// --------------------------------------

if (
    subject.length > 120
) {

    subject =
        subject
            .substring(
                0,
                120
            )
            .trim();
}


return (
    subject ||
    "the affected functionality"
);

}

// ==========================================
// CAPITALIZE
// ==========================================

function capitalize(
text
) {

if (!text) {

    return (
        "The affected functionality"
    );
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


        request.onerror =
            () => {

                reject(
                    request.error
                );
            };


        request.onsuccess =
            () => {

                const db =
                    request.result;


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


                    getRequest.onsuccess =
                        () => {

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


                    getRequest.onerror =
                        () => {

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

// ==========================================
// WAIT FOR VIDEO
// ==========================================

async function waitForLatestBugVideo(
timeout = 2500,
interval = 250
) {

const start =
    Date.now();


while (
    Date.now() - start <
    timeout
) {

    try {

        const video =
            await getLatestBugVideo();


        if (video) {

            return video;
        }

    } catch (error) {

        // Continue polling.
    }


    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                interval
            )
    );
}


return null;

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
// COPY SCREENSHOT
// ==========================================

if (copyScreenshotButton) {

copyScreenshotButton.addEventListener(
    "click",
    async () => {

        try {

            if (
                !bugData ||
                !bugData.screenshot
            ) {

                showError(
                    "No screenshot available."
                );

                return;
            }


            const response =
                await fetch(
                    bugData.screenshot
                );


            const blob =
                await response.blob();


            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]:
                        blob
                })
            ]);


            copyScreenshotButton.textContent =
                "✅ Copied!";


            setTimeout(
                () => {

                    copyScreenshotButton.textContent =
                        "📋 Copy Screenshot";

                },
                2000
            );


        } catch (err) {

            console.error(
                "Screenshot copy failed:",
                err
            );

            showError(
                "Unable to copy screenshot."
            );
        }
    }
);

}

// ==========================================
// DOWNLOAD SCREENSHOT
// ==========================================

if (downloadScreenshotButton) {

downloadScreenshotButton.addEventListener(
    "click",
    async () => {

        try {

            if (
                !bugData ||
                !bugData.screenshot
            ) {

                showError(
                    "No screenshot available."
                );

                return;
            }


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                bugData.screenshot;


            link.download =
                `bug-screenshot-${Date.now()}.png`;


            document.body.appendChild(
                link
            );


            link.click();


            document.body.removeChild(
                link
            );


            downloadScreenshotButton.textContent =
                "✅ Downloaded!";


            setTimeout(
                () => {

                    downloadScreenshotButton.textContent =
                        "⬇️ Download Screenshot";

                },
                2000
            );


        } catch (err) {

            console.error(
                "Screenshot download failed:",
                err
            );

            showError(
                "Unable to download screenshot."
            );
        }
    }
);

}

// ==========================================
// DOWNLOAD VIDEO
// ==========================================

if (downloadVideoButton) {

downloadVideoButton.addEventListener(
    "click",
    async () => {

        try {

            const videoData =
                await getLatestBugVideo();


            if (!videoData) {

                showError(
                    "No recorded video available."
                );

                return;
            }


            const videoUrl =
                URL.createObjectURL(
                    videoData
                );


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                videoUrl;


            link.download =
                `bug-recording-${Date.now()}.webm`;


            document.body.appendChild(
                link
            );


            link.click();


            document.body.removeChild(
                link
            );


            setTimeout(
                () => {

                    URL.revokeObjectURL(
                        videoUrl
                    );

                },
                1000
            );


            downloadVideoButton.textContent =
                "✅ Downloaded!";


            setTimeout(
                () => {

                    downloadVideoButton.textContent =
                        "⬇️ Download Video";

                },
                2000
            );


        } catch (err) {

            console.error(
                "Video download failed:",
                err
            );

            showError(
                "Unable to download video."
            );
        }
    }
);

}

// ==========================================
// SET TEXT HELPER
// ==========================================

function setText(
id,
value
) {

const element =
    document.getElementById(
        id
    );


if (element) {

    element.textContent =
        value || "";
}

}

// ==========================================
// ERROR HANDLING
// ==========================================

function showError(
message
) {

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