// ==========================================
// AI BUG REPORTER - BACKGROUND
// ==========================================

let videoRecordingTabId = null;


// ==========================================
// CREATE OFFSCREEN DOCUMENT
// ==========================================

async function ensureOffscreenDocument() {

    const offscreenUrl =
        chrome.runtime.getURL("offscreen.html");

    const existingContexts =
        await chrome.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
            documentUrls: [offscreenUrl]
        });

    if (existingContexts.length > 0) {
        return;
    }

    await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["USER_MEDIA"],
        justification:
            "Record browser tab video for bug reporting."
    });

    console.log("Offscreen document created.");
}


// ==========================================
// START VIDEO RECORDING
// ==========================================

async function startVideoRecording() {

    try {

        const tabs =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

        if (!tabs || tabs.length === 0) {
            throw new Error("Active tab not found.");
        }

        const tab = tabs[0];

        if (!tab.id) {
            throw new Error("Tab ID not found.");
        }

        videoRecordingTabId = tab.id;

        console.log(
            "Recording tab:",
            tab.id
        );


        // ==================================
        // GET STREAM ID
        // ==================================

        const streamId =
            await chrome.tabCapture.getMediaStreamId({
                targetTabId: tab.id
            });

        console.log(
            "Stream ID received."
        );


        // ==================================
        // CREATE OFFSCREEN DOCUMENT
        // ==================================

        await ensureOffscreenDocument();


        // ==================================
        // SEND STREAM TO OFFSCREEN
        // ==================================

        chrome.runtime.sendMessage({
            type: "START_VIDEO_RECORDING",
            streamId: streamId
        });


        await chrome.storage.local.set({

            videoRecordingActive: true,

            videoRecordingError: null,

            videoRecordingStartedAt:
                new Date().toISOString(),

            videoRecordingTabId:
                tab.id
        });


        console.log(
            "Video recording started."
        );

    }

    catch (error) {

        console.error(
            "Unable to start video recording:",
            error
        );

        await chrome.storage.local.set({

            videoRecordingActive: false,

            videoRecordingError:
                error.message
        });
    }
}


// ==========================================
// STOP VIDEO RECORDING
// ==========================================

async function stopVideoRecording() {

    try {

        const contexts =
            await chrome.runtime.getContexts({
                contextTypes: ["OFFSCREEN_DOCUMENT"]
            });

        if (contexts.length === 0) {

            console.log(
                "Offscreen document does not exist."
            );

            return;
        }


        chrome.runtime.sendMessage({

            type:
                "STOP_VIDEO_RECORDING"

        });


        console.log(
            "Stop video command sent."
        );

    }

    catch (error) {

        console.error(
            "Unable to stop video:",
            error
        );
    }
}


// ==========================================
// MESSAGE LISTENER
// ==========================================

chrome.runtime.onMessage.addListener(

    (message, sender, sendResponse) => {

        // ==================================
        // START VIDEO
        // ==================================

        if (
            message.type === "START_VIDEO"
        ) {

            startVideoRecording()
                .then(() => {

                    sendResponse({
                        success: true
                    });

                })
                .catch(error => {

                    sendResponse({
                        success: false,
                        error: error.message
                    });

                });

            return true;
        }


        // ==================================
        // STOP VIDEO
        // ==================================

        if (
            message.type === "STOP_VIDEO"
        ) {

            stopVideoRecording()
                .then(() => {

                    sendResponse({
                        success: true
                    });

                })
                .catch(error => {

                    sendResponse({
                        success: false,
                        error: error.message
                    });

                });

            return true;
        }


        // ==================================
        // VIDEO COMPLETE
        // ==================================

        if (
            message.type ===
            "VIDEO_RECORDING_COMPLETE"
        ) {

            console.log(
                "Video recording completed.",
                message.size
            );

            chrome.storage.local.set({

                videoRecordingActive: false,

                videoSize:
                    message.size,

                videoRecordedAt:
                    new Date().toISOString()

            });

            return;
        }


        // ==================================
        // VIDEO ERROR
        // ==================================

        if (
            message.type ===
            "VIDEO_RECORDING_ERROR"
        ) {

            console.error(
                "Video recording error:",
                message.error
            );

            chrome.storage.local.set({

                videoRecordingActive: false,

                videoRecordingError:
                    message.error

            });

            return;
        }

    }
);