const OFFSCREEN_DOCUMENT_PATH =
    "offscreen.html";


// ==========================================
// STATE
// ==========================================

let actionWriteQueue =
    Promise.resolve();

let videoStartInProgress =
    false;

let videoRecordingTabId =
    null;


// ==========================================
// GET ACTIVE TAB
// ==========================================

async function getActiveTab() {

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
            "Active tab not found."
        );
    }

    return tabs[0];
}


// ==========================================
// CHECK / INJECT CONTENT SCRIPT
// ==========================================

async function ensureContentScript(
    tabId
) {

    if (
        typeof tabId !== "number"
    ) {
        return false;
    }


    // --------------------------------------
    // FIRST: PING EXISTING SCRIPT
    // --------------------------------------

    try {

        const response =
            await chrome.tabs.sendMessage(
                tabId,
                {
                    type:
                        "AI_BUG_REPORTER_PING"
                }
            );

        if (
            response &&
            response.ok === true
        ) {

            console.log(
                "Existing content script is active."
            );

            return true;
        }

    } catch (error) {

        // This is expected when:
        // - old content context was invalidated
        // - content script does not exist
        // - restricted page
    }


    // --------------------------------------
    // INJECT FRESH CONTENT SCRIPT
    // --------------------------------------

    try {

        await chrome.scripting.executeScript({
            target: {
                tabId: tabId
            },
            files: [
                "content.js"
            ]
        });

        console.log(
            "Fresh content.js injected into tab:",
            tabId
        );

        return true;

    } catch (error) {

        console.warn(
            "Unable to inject content.js:",
            error
        );

        return false;
    }
}


// ==========================================
// RECORD ACTION
// ==========================================

function queueRecordAction(
    action
) {

    actionWriteQueue =
        actionWriteQueue
            .then(
                async () => {

                    try {

                        const storage =
                            await chrome.storage.local.get([
                                "captureActive",
                                "userActions"
                            ]);

                        if (
                            storage.captureActive !==
                            true
                        ) {
                            return;
                        }


                        let actions =
                            Array.isArray(
                                storage.userActions
                            )
                                ? storage.userActions
                                : [];


                        if (
                            !action ||
                            !action.type
                        ) {
                            return;
                        }


                        actions.push(
                            action
                        );


                        if (
                            actions.length >
                            50
                        ) {

                            actions =
                                actions.slice(
                                    -50
                                );
                        }


                        await chrome.storage.local.set({
                            userActions:
                                actions
                        });

                    } catch (error) {

                        console.warn(
                            "Unable to save user action:",
                            error
                        );
                    }
                }
            )
            .catch(
                (error) => {

                    console.warn(
                        "Action queue error:",
                        error
                    );
                }
            );

    return actionWriteQueue;
}


// ==========================================
// OFFSCREEN DOCUMENT
// ==========================================

async function setupOffscreenDocument() {

    try {

        const contexts =
            await chrome.runtime.getContexts({
                contextTypes: [
                    "OFFSCREEN_DOCUMENT"
                ],
                documentUrls: [
                    chrome.runtime.getURL(
                        OFFSCREEN_DOCUMENT_PATH
                    )
                ]
            });

        if (
            contexts &&
            contexts.length > 0
        ) {

            return;
        }

    } catch (error) {

        console.warn(
            "Unable to check offscreen context:",
            error
        );
    }


    try {

        await chrome.offscreen.createDocument({

            url:
                OFFSCREEN_DOCUMENT_PATH,

            reasons: [
                "USER_MEDIA"
            ],

            justification:
                "Record the active browser tab for bug reproduction evidence."
        });

        console.log(
            "Offscreen document created."
        );

    } catch (error) {

        const message =
            String(
                error?.message ||
                error
            ).toLowerCase();

        if (
            !message.includes(
                "already exists"
            )
        ) {

            throw error;
        }
    }
}


// ==========================================
// START VIDEO RECORDING
// ==========================================

async function startVideoRecording(
    tab
) {

    if (
        videoStartInProgress
    ) {

        return {
            success: false,
            message:
                "Video recording is already starting."
        };
    }


    if (
        !tab ||
        typeof tab.id !== "number"
    ) {

        return {
            success: false,
            message:
                "Active tab not found."
        };
    }


    videoStartInProgress =
        true;


    try {

        // ----------------------------------
        // CHECK EXISTING CAPTURE
        // ----------------------------------

        try {

            const capturedTabs =
                await chrome.tabCapture.getCapturedTabs();

            const existing =
                capturedTabs.find(
                    (item) =>
                        item.tabId ===
                        tab.id &&
                        (
                            item.status ===
                                "active" ||
                            item.status ===
                                "pending"
                        )
                );

            if (existing) {

                videoRecordingTabId =
                    tab.id;

                await chrome.storage.local.set({

                    videoRecordingActive:
                        true,

                    videoRecordingError:
                        ""

                });

                return {
                    success: true,
                    alreadyActive: true
                };
            }

        } catch (error) {

            console.warn(
                "Unable to check existing capture:",
                error
            );
        }


        // ----------------------------------
        // GET STREAM ID
        // ----------------------------------

        const streamId =
            await chrome.tabCapture.getMediaStreamId({
                targetTabId:
                    tab.id
            });


        if (!streamId) {

            throw new Error(
                "Unable to obtain tab media stream."
            );
        }


        // ----------------------------------
        // CREATE OFFSCREEN DOCUMENT
        // ----------------------------------

        await setupOffscreenDocument();


        // ----------------------------------
        // SEND STREAM TO OFFSCREEN
        // ----------------------------------

        await new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    100
                )
        );


        await chrome.runtime.sendMessage({

            type:
                "START_VIDEO_RECORDING",

            streamId:
                streamId
        });


        videoRecordingTabId =
            tab.id;


        await chrome.storage.local.set({

            videoRecordingActive:
                true,

            videoRecordingError:
                ""

        });


        console.log(
            "Video recording started for tab:",
            tab.id
        );


        return {
            success: true
        };

    } catch (error) {

        console.error(
            "Video recording start failed:",
            error
        );


        await chrome.storage.local.set({

            videoRecordingActive:
                false,

            videoRecordingError:
                String(
                    error?.message ||
                    error
                )

        });


        return {

            success: false,

            message:
                String(
                    error?.message ||
                    "Unable to start video recording."
                )

        };

    } finally {

        videoStartInProgress =
            false;
    }
}


// ==========================================
// STOP VIDEO RECORDING
// ==========================================

async function stopVideoRecording() {

    try {

        let offscreenExists =
            false;


        try {

            const contexts =
                await chrome.runtime.getContexts({

                    contextTypes: [
                        "OFFSCREEN_DOCUMENT"
                    ],

                    documentUrls: [
                        chrome.runtime.getURL(
                            OFFSCREEN_DOCUMENT_PATH
                        )
                    ]

                });

            offscreenExists =
                contexts &&
                contexts.length > 0;

        } catch (error) {

            offscreenExists =
                false;
        }


        if (
            offscreenExists
        ) {

            try {

                await chrome.runtime.sendMessage({

                    type:
                        "STOP_VIDEO_RECORDING"

                });

            } catch (error) {

                console.warn(
                    "Unable to send stop message to offscreen:",
                    error
                );
            }

        }


        videoRecordingTabId =
            null;


        await chrome.storage.local.set({

            videoRecordingActive:
                false

        });


        console.log(
            "Video recording stop requested."
        );


        return {
            success: true
        };

    } catch (error) {

        console.error(
            "Video stop failed:",
            error
        );


        await chrome.storage.local.set({

            videoRecordingActive:
                false

        });


        return {

            success: false,

            message:
                String(
                    error?.message ||
                    "Unable to stop video recording."
                )

        };
    }
}


// ==========================================
// RUNTIME MESSAGE LISTENER
// ==========================================

chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {

        // ==================================
        // RECORD ACTION
        // ==================================

        if (
            message?.type ===
            "RECORD_ACTION"
        ) {

            if (
                sender &&
                sender.tab &&
                typeof sender.tab.id ===
                    "number"
            ) {

                queueRecordAction(
                    message.action
                );
            }

            sendResponse({
                ok: true
            });

            return false;
        }


        // ==================================
        // START VIDEO
        // ==================================

        if (
            message?.type ===
            "START_VIDEO"
        ) {

            (async () => {

                try {

                    const tab =
                        await getActiveTab();


                    // --------------------------------
                    // IMPORTANT:
                    // VERIFY / REFRESH CONTENT SCRIPT
                    // --------------------------------

                    const contentScriptReady =
                        await ensureContentScript(
                            tab.id
                        );


                    await chrome.storage.local.set({

                        contentScriptReady:
                            contentScriptReady

                    });


                    // --------------------------------
                    // START VIDEO
                    // --------------------------------

                    const videoResult =
                        await startVideoRecording(
                            tab
                        );


                    sendResponse({

                        ok: true,

                        contentScriptReady:
                            contentScriptReady,

                        video:
                            videoResult

                    });

                } catch (error) {

                    console.error(
                        "START_VIDEO failed:",
                        error
                    );


                    sendResponse({

                        ok: false,

                        error:
                            String(
                                error?.message ||
                                error
                            )

                    });
                }

            })();


            return true;
        }


        // ==================================
        // STOP VIDEO
        // ==================================

        if (
            message?.type ===
            "STOP_VIDEO"
        ) {

            (async () => {

                try {

                    const result =
                        await stopVideoRecording();


                    sendResponse({

                        ok:
                            result.success,

                        video:
                            result

                    });

                } catch (error) {

                    sendResponse({

                        ok: false,

                        error:
                            String(
                                error?.message ||
                                error
                            )

                    });
                }

            })();


            return true;
        }


        // ==================================
        // VIDEO COMPLETE
        // ==================================

        if (
            message?.type ===
            "VIDEO_RECORDING_COMPLETE"
        ) {

            chrome.storage.local.set({

                videoRecordingActive:
                    false,

                videoRecordingError:
                    ""

            });


            console.log(
                "Video recording completed."
            );


            sendResponse({
                ok: true
            });

            return false;
        }


        // ==================================
        // VIDEO ERROR
        // ==================================

        if (
            message?.type ===
            "VIDEO_RECORDING_ERROR"
        ) {

            chrome.storage.local.set({

                videoRecordingActive:
                    false,

                videoRecordingError:
                    message.error ||
                    "Unknown video recording error."

            });


            console.error(
                "Video recording error:",
                message.error
            );


            sendResponse({
                ok: true
            });

            return false;
        }
    }
);


// ==========================================
// TAB CLOSED
// ==========================================

chrome.tabs.onRemoved.addListener(
    async (tabId) => {

        if (
            tabId ===
            videoRecordingTabId
        ) {

            videoRecordingTabId =
                null;

            await chrome.storage.local.set({

                videoRecordingActive:
                    false

            });
        }
    }
);


// ==========================================
// EXTENSION INSTALLED / UPDATED
// ==========================================

chrome.runtime.onInstalled.addListener(
    async () => {

        try {

            await chrome.storage.local.set({

                captureActive:
                    false,

                videoRecordingActive:
                    false,

                videoRecordingError:
                    "",

                contentScriptReady:
                    false

            });

        } catch (error) {

            console.warn(
                "Unable to initialize extension state:",
                error
            );
        }
    }
);
