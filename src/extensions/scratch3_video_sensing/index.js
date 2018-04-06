const Runtime = require('../../engine/runtime');

const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Clone = require('../../util/clone');
const log = require('../../util/log');

const VideoMotion = require('./library');

/**
 * Class for the motion-related blocks in Scratch 3.0
 * @param {Runtime} runtime - the runtime instantiating this block package.
 * @constructor
 */
class Scratch3VideoSensingBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;

        /**
         * The motion detection algoritm used to power the motion amount and
         * direction values.
         * @type {VideoMotion}
         */
        this.detect = new VideoMotion();

        /**
         * The last millisecond epoch timestamp that the video stream was
         * analyzed.
         * @type {number}
         */
        this._lastUpdate = null;

        /**
         * Id representing a Scratch Renderer skin the video is rendered to for
         * previewing.
         * @type {number}
         */
        this._skinId = -1;

        /**
         * The Scratch Renderer Skin object.
         * @type {Skin}
         */
        this._skin = null;

        /**
         * Id for a drawable using the video's skin that will render as a video
         * preview.
         * @type {Drawable}
         */
        this._drawable = -1;

        /**
         * Canvas DOM element video is rendered to down or up sample to the
         * expected resolution.
         * @type {HTMLCanvasElement}
         */
        this._sampleCanvas = null;

        /**
         * Canvas 2D Context to render to the _sampleCanvas member.
         * @type {CanvasRenderingContext2D}
         */
        this._sampleContext = null;

        // Clear target motion state values when the project starts.
        this.runtime.on(Runtime.PROJECT_RUN_START, this.reset.bind(this));

        // Boot up the video, canvas to down/up sample the video stream, the
        // preview skin and drawable, and kick off looping the analysis logic.
        this._setupVideo();
        this._setupSampleCanvas();
        this._setupPreview();
        this._loop();
    }

    /**
     * After analyzing a frame the amount of milliseconds until another frame
     * is analyzed.
     * @type {number}
     */
    static get INTERVAL () {
        return 33;
    }

    /**
     * Dimensions the video stream is analyzed at after its rendered to the
     * sample canvas.
     * @type {Array.<number>}
     */
    static get DIMENSIONS () {
        return [480, 360];
    }

    /**
     * Order preview drawable is inserted at in the renderer.
     * @type {number}
     */
    static get ORDER () {
        return 1;
    }

    /**
     * The key to load & store a target's motion-related state.
     * @type {string}
     */
    static get STATE_KEY () {
        return 'Scratch.videoSensing';
    }

    /**
     * The default motion-related state, to be used when a target has no existing motion state.
     * @type {MotionState}
     */
    static get DEFAULT_MOTION_STATE () {
        return {
            motionFrameNumber: 0,
            motionAmount: 0,
            motionDirection: 0
        };
    }

    /**
     * Reset the extension's data motion detection data. This will clear out
     * for example old frames, so the first analyzed frame will not be compared
     * against a frame from before reset was called.
     */
    reset () {
        this.detect.reset();

        const targets = this.runtime.targets;
        for (let i = 0; i < targets.length; i++) {
            const state = targets[i].getCustomState(Scratch3VideoSensingBlocks.STATE_KEY);
            if (state) {
                state.motionAmount = 0;
                state.motionDirection = 0;
            }
        }
    }

    /**
     * Setup a video element connected to a user media stream.
     * @private
     */
    _setupVideo () {
        this._video = document.createElement('video');
        navigator.getUserMedia({
            audio: false,
            video: {
                width: {min: 480, ideal: 640},
                height: {min: 360, ideal: 480}
            }
        }, stream => {
            this._video.src = window.URL.createObjectURL(stream);
            // Hint to the stream that it should load. A standard way to do this
            // is add the video tag to the DOM. Since this extension wants to
            // hide the video tag and instead render a sample of the stream into
            // the webgl rendered Scratch canvas, another hint like this one is
            // needed.
            this._track = stream.getTracks()[0];
        }, err => {
            // @todo Properly handle errors
            log(err);
        });
    }

    /**
     * Create a campus to render the user media video to down/up sample to the
     * needed resolution.
     * @private
     */
    _setupSampleCanvas () {
        // Create low-resolution image to sample video for analysis and preview
        const canvas = this._sampleCanvas = document.createElement('canvas');
        canvas.width = Scratch3VideoSensingBlocks.DIMENSIONS[0];
        canvas.height = Scratch3VideoSensingBlocks.DIMENSIONS[1];
        this._sampleContext = canvas.getContext('2d');
    }

    /**
     * Create a Scratch Renderer Skin and Drawable to preview the user media
     * video stream.
     * @private
     */
    _setupPreview () {
        if (this._skinId !== -1) return;
        if (this._skin !== null) return;
        if (this._drawable !== -1) return;
        if (!this.runtime.renderer) return;

        this._skinId = this.runtime.renderer.createPenSkin();
        this._skin = this.runtime.renderer._allSkins[this._skinId];
        this._drawable = this.runtime.renderer.createDrawable();
        this.runtime.renderer.setDrawableOrder(
            this._drawable,
            Scratch3VideoSensingBlocks.ORDER
        );
        this.runtime.renderer.updateDrawableProperties(this._drawable, {
            skinId: this._skinId
        });
    }

    /**
     * Occasionally step a loop to sample the video, stamp it to the preview
     * skin, and add a TypedArray copy of the canvas's pixel data.
     * @private
     */
    _loop () {
        setTimeout(this._loop.bind(this), this.runtime.currentStepTime);

        // Ensure video stream is established
        if (!this._video) return;
        if (!this._track) return;
        if (typeof this._video.videoWidth !== 'number') return;
        if (typeof this._video.videoHeight !== 'number') return;

        // Bail if the camera is *still* not ready
        const nativeWidth = this._video.videoWidth;
        const nativeHeight = this._video.videoHeight;
        if (nativeWidth === 0) return;
        if (nativeHeight === 0) return;

        const ctx = this._sampleContext;

        // Mirror
        ctx.scale(-1, 1);

        // Generate video thumbnail for analysis
        ctx.drawImage(
            this._video,
            0,
            0,
            nativeWidth,
            nativeHeight,
            Scratch3VideoSensingBlocks.DIMENSIONS[0] * -1,
            0,
            Scratch3VideoSensingBlocks.DIMENSIONS[0],
            Scratch3VideoSensingBlocks.DIMENSIONS[1]
        );

        // Restore the canvas transform
        ctx.resetTransform();

        // Render to preview layer
        if (this._skin !== null) {
            const xOffset = Scratch3VideoSensingBlocks.DIMENSIONS[0] / 2 * -1;
            const yOffset = Scratch3VideoSensingBlocks.DIMENSIONS[1] / 2;
            this._skin.drawStamp(this._sampleCanvas, xOffset, yOffset);
            this.runtime.requestRedraw();
        }

        // Add frame to detector
        const time = Date.now();
        if (this._lastUpdate === null) this._lastUpdate = time;
        const offset = time - this._lastUpdate;
        if (offset > Scratch3VideoSensingBlocks.INTERVAL) {
            this._lastUpdate = time;
            const data = ctx.getImageData(
                0, 0, Scratch3VideoSensingBlocks.DIMENSIONS[0], Scratch3VideoSensingBlocks.DIMENSIONS[1]
            );
            this.detect.addFrame(data.data);
        }
    }

    /**
     * Create data for a menu in scratch-blocks format, consisting of an array
     * of objects with text and value properties. The text is a translated
     * string, and the value is one-indexed.
     * @param {object[]} info - An array of info objects each having a name
     *   property.
     * @return {array} - An array of objects with text and value properties.
     * @private
     */
    _buildMenu (info) {
        return info.map((entry, index) => {
            const obj = {};
            obj.text = entry.name;
            obj.value = String(index + 1);
            return obj;
        });
    }

    /**
     * @param {Target} target - collect motion state for this target.
     * @returns {MotionState} the mutable motion state associated with that
     *   target. This will be created if necessary.
     * @private
     */
    _getMotionState (target) {
        let motionState = target.getCustomState(Scratch3VideoSensingBlocks.STATE_KEY);
        if (!motionState) {
            motionState = Clone.simple(Scratch3VideoSensingBlocks.DEFAULT_MOTION_STATE);
            target.setCustomState(Scratch3VideoSensingBlocks.STATE_KEY, motionState);
        }
        return motionState;
    }

    /**
     * An array of choices of whether a reporter should return the frame's
     * motion amount or direction.
     * @type {object[]} an array of objects.
     * @param {string} name - the translatable name to display in the drums menu.
     * @param {string} fileName - the name of the audio file containing the drum sound.
     */
    get MOTION_DIRECTION_INFO () {
        return [
            {
                name: 'motion'
            },
            {
                name: 'direction'
            }
        ];
    }

    /**
     * An array of info about each drum.
     * @type {object[]} an array of objects.
     * @param {string} name - the translatable name to display in the drums
     *   menu.
     * @param {string} fileName - the name of the audio file containing the
     *   drum sound.
     */
    get STAGE_SPRITE_INFO () {
        return [
            {
                name: 'stage'
            },
            {
                name: 'sprite'
            }
        ];
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        return {
            id: 'videoSensing',
            name: 'Video Sensing',
            blocks: [
                {
                    opcode: 'videoOn',
                    blockType: BlockType.REPORTER,
                    text: 'video [MOTION_DIRECTION] on [STAGE_SPRITE]',
                    arguments: {
                        MOTION_DIRECTION: {
                            type: ArgumentType.NUMBER,
                            menu: 'MOTION_DIRECTION',
                            defaultValue: 1
                        },
                        STAGE_SPRITE: {
                            type: ArgumentType.NUMBER,
                            menu: 'STAGE_SPRITE',
                            defaultValue: 1
                        }
                    }
                },
                {
                    // @todo this hat needs to be set itself to restart existing
                    // threads like Scratch 2's behaviour.
                    opcode: 'whenMotionGreaterThan',
                    text: 'when video motion > [REFERENCE]',
                    blockType: BlockType.HAT,
                    arguments: {
                        REFERENCE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 10
                        }
                    }
                }
            ],
            menus: {
                MOTION_DIRECTION: this._buildMenu(this.MOTION_DIRECTION_INFO),
                STAGE_SPRITE: this._buildMenu(this.STAGE_SPRITE_INFO)
            }
        };
    }

    /**
     * Analyze a part of the frame that a target overlaps.
     * @param {Target} target - a target to determine where to analyze
     * @returns {MotionState} the motion state for the given target
     */
    _analyzeLocalMotion (target) {
        const drawable = this.runtime.renderer._allDrawables[target.drawableID];
        const state = this._getMotionState(target);
        this.detect.getLocalMotion(drawable, state);
        return state;
    }

    /**
     * A scratch reporter block handle that analyzes the last two frames and
     * depending on the arguments, returns the motion or direction for the
     * whole stage or just the target sprite.
     * @param {object} args - the block arguments
     * @param {BlockUtility} util - the block utility
     * @returns {number} the motion amount or direction of the stage or sprite
     */
    videoOn (args, util) {
        this.detect.analyzeFrame();

        let state = this.detect;
        if (Number(args.STAGE_SPRITE) === 2) {
            state = this._analyzeLocalMotion(util.target);
        }

        if (Number(args.MOTION_DIRECTION) === 1) {
            return state.motionAmount;
        }
        return state.motionDirection;
    }

    /**
     * A scratch hat block edge handle that analyzes the last two frames where
     * the target sprite overlaps and if it has more motion than the given
     * reference value.
     * @param {object} args - the block arguments
     * @param {BlockUtility} util - the block utility
     * @returns {boolean} true if the sprite overlaps more motion than the
     *   reference
     */
    whenMotionGreaterThan (args, util) {
        this.detect.analyzeFrame();
        const state = this._analyzeLocalMotion(util.target);
        return state.motionAmount > Number(args.REFERENCE);
    }
}

module.exports = Scratch3VideoSensingBlocks;
