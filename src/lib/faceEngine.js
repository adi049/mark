/**
 * Browser face engine (Phase 7).
 *
 * The AI runs entirely in the visitor's or the admin's browser using
 * TensorFlow.js face nets from @vladmandic/face-api (the maintained fork
 * of face-api.js, MIT licensed, no paid API). The model weights are served
 * from /models on this site, so nothing leaves the browser and there is no
 * external AI service.
 *
 * The library is loaded lazily: the multi-megabyte engine only downloads
 * when someone actually opens a face scan or starts admin indexing.
 */

/** Face library directory, served from public/models. */
export const FACE_MODEL_URL = `${import.meta.env.BASE_URL || '/'}models`

/**
 * Euclidean distance below which two descriptors count as the same face.
 * face-api descriptors are L2 normalised, so distances run 0 (identical)
 * to about 2 (opposite). 0.5 is a conservative starting point; tune here
 * if matches feel too strict or too loose. The server clamps the value it
 * receives to a sane band.
 */
export const FACE_MATCH_THRESHOLD = 0.5

let enginePromise = null

/**
 * Loads the detection, landmark and recognition nets once.
 * @returns {Promise<object>} the face-api namespace
 */
export function loadFaceEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL)
      await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL)
      await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL)
      return faceapi
    })()
  }
  return enginePromise
}

/**
 * Detects every face with landmarks and a 128-value descriptor.
 * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input
 * @returns {Promise<Array>} face-api results: detection, landmarks, descriptor
 */
export async function detectFaces(
  input,
  { inputSize = 416, scoreThreshold = 0.5 } = {}
) {
  const faceapi = await loadFaceEngine()
  return faceapi.detectAllFaces(
    input,
    new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })
  ).withFaceLandmarks().withFaceDescriptors()
}

/**
 * Formats a descriptor for the search RPC. Sent as text because RPC
 * arguments travel as JSON; the server casts it to vector(128).
 * @param {Float32Array|number[]} descriptor
 * @returns {string}
 */
export function descriptorToText(descriptor) {
  return `[${Array.from(descriptor)
    .map((value) => Number(value).toFixed(6))
    .join(',')}]`
}
