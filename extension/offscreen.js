let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;


// ==========================================
// START RECORDING
// ==========================================

async function startRecording(streamId) {

    try {

        console.log(
            "Starting video recording..."
        );

        recordedChunks = [];


        // ==================================
        // GET TAB STREAM
        // ==================================

        const stream =
            await navigator.mediaDevices.getUserMedia({

                audio: false,

                video: {

                    mandatory: {

                        chromeMediaSource:
                            "tab",

                        chromeMediaSourceId:
                            streamId
                    }

                }

            });


        console.log(
            "Tab stream received."
        );


        // ==================================
        // CREATE MEDIA RECORDER
        // ==================================

        let mimeType =
            "video/webm;codecs=vp9";

        if (
            !MediaRecorder.isTypeSupported(
                mimeType
            )
        ) {

            mimeType =
                "video/webm;codecs=vp8";

        }


        mediaRecorder =
            new MediaRecorder(
                stream,
                {
                    mimeType: mimeType
                }
            );


        // ==================================
        // VIDEO DATA
        // ==================================

        mediaRecorder.ondataavailable =
            (event) => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    recordedChunks.push(
                        event.data
                    );

                }

            };


        // ==================================
        // RECORDING STOP
        // ==================================

        mediaRecorder.onstop =
            async () => {

                try {

                    console.log(
                        "MediaRecorder stopped."
                    );


                    const videoBlob =
                        new Blob(
                            recordedChunks,
                            {
                                type:
                                    "video/webm"
                            }
                        );


                    console.log(
                        "Video size:",
                        videoBlob.size
                    );


                    // ==========================
                    // STOP STREAM
                    // ==========================

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );


                    // ==========================
                    // SAVE VIDEO
                    // ==========================

                    await saveVideo(
                        videoBlob
                    );


                    // ==========================
                    // STORAGE
                    // ==========================

                    await chrome.storage.local.set({

                        videoRecordingActive:
                            false,

                        videoSize:
                            videoBlob.size,

                        videoRecordedAt:
                            new Date().toISOString()

                    });


                    console.log(
                        "Video saved successfully."
                    );


                    // ==========================
                    // NOTIFY BACKGROUND
                    // ==========================

                    chrome.runtime.sendMessage({

                        type:
                            "VIDEO_RECORDING_COMPLETE",

                        size:
                            videoBlob.size

                    });

                }

                catch (error) {

                    console.error(
                        "Video save failed:",
                        error
                    );

                }

            };


        // ==================================
        // START MEDIA RECORDER
        // ==================================

        mediaRecorder.start(1000);

        recordingStartTime =
            Date.now();


        await chrome.storage.local.set({

            videoRecordingActive:
                true,

            videoRecordingStartedAt:
                new Date().toISOString()

        });


        console.log(
            "Video recording started."
        );

    }

    catch (error) {

        console.error(
            "Video recording failed:",
            error
        );

        chrome.runtime.sendMessage({

            type:
                "VIDEO_RECORDING_ERROR",

            error:
                error.message

        });

    }
}


// ==========================================
// STOP RECORDING
// ==========================================

function stopRecording() {

    console.log(
        "Stopping video recording..."
    );


    if (
        mediaRecorder &&
        mediaRecorder.state !== "inactive"
    ) {

        mediaRecorder.stop();

        console.log(
            "Stop command sent."
        );

    }

    else {

        console.log(
            "No active video recording."
        );

    }
}


// ==========================================
// INDEXED DB
// ==========================================

function openDatabase() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    "AIBugReporterDB",
                    1
                );


            request.onupgradeneeded =
                () => {

                    const db =
                        request.result;


                    if (
                        !db.objectStoreNames.contains(
                            "videos"
                        )
                    ) {

                        db.createObjectStore(
                            "videos",
                            {
                                keyPath: "id"
                            }
                        );

                    }

                };


            request.onsuccess =
                () => {

                    resolve(
                        request.result
                    );

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


// ==========================================
// SAVE VIDEO
// ==========================================

async function saveVideo(blob) {

    const db =
        await openDatabase();


    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    "videos",
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    "videos"
                );


            store.put({

                id:
                    "latestBugVideo",

                blob:
                    blob,

                createdAt:
                    new Date().toISOString()

            });


            transaction.oncomplete =
                () => {

                    console.log(
                        "Video stored in IndexedDB."
                    );

                    resolve();

                };


            transaction.onerror =
                () => {

                    reject(
                        transaction.error
                    );

                };

        }
    );

}


// ==========================================
// MESSAGE LISTENER
// ==========================================

chrome.runtime.onMessage.addListener(

    (message) => {

        // START
        if (
            message.type ===
            "START_VIDEO_RECORDING"
        ) {

            startRecording(
                message.streamId
            );

        }


        // STOP
        if (
            message.type ===
            "STOP_VIDEO_RECORDING"
        ) {

            stopRecording();

        }

    }

);