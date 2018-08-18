const mixin = {
    methods: {
        $smoothReflow(options) {
            let _registerElement = registerElement.bind(this)
            if (Array.isArray(options))
                options.forEach(_registerElement)
            else
                _registerElement(options)
        },
        $unsmoothReflow(options) {
            let _unregisterElement = unregisterElement.bind(this)
            if (Array.isArray(options))
                options.forEach(_unregisterElement)
            else
                _unregisterElement(options)
        },
    },
    beforeCreate() {
        this._smoothElements = []
        this._endListener = event => {
            for (let smoothEl of this._smoothElements) {
                smoothEl.endListener(event)
            }
        }
    },
    mounted() {
        this.$el.addEventListener('transitionend', this._endListener, { passive: true })
    },
    destroyed() {
        this.$el.removeEventListener('transitionend', this._endListener)
    },
    beforeUpdate() {
        flushRemoved(this)
        for (let smoothEl of this._smoothElements) {
            smoothEl.setBeforeValues()
        }
    },
    async updated() {
        await this.$nextTick()
        for (let smoothEl of this._smoothElements) {
            smoothEl.doSmoothReflow()
        }
        flushRemoved(this)
    }
}

function flushRemoved(vm) {
    let i = vm._smoothElements.length
    while (i--) {
        let smoothEl = vm._smoothElements[i]
        if (smoothEl.isRemoved) {
            smoothEl.stopTransition()
            vm._smoothElements.splice(i, 1)
        }
    }
}

// 'this' is vue component
function registerElement(option = {}) {
    this._smoothElements.push(new SmoothElement(option, this.$el))
}

// 'this' is vue component
function unregisterElement(option) {
    let root = this.$el
    let index = this._smoothElements.findIndex(d => {
        return select(root, d.options.el) === select(root, option.el)
    })
    if (index == -1) {
        console.error("VSR_ERROR: $unsmoothReflow failed due to invalid el option")
        return
    }
    // Don't remove right away, as it might be in the middle of
    // a doSmoothReflow, and leave the element in a broken state.
    this._smoothElements[index].scheduleRemoval()
}

function select(rootEl, el) {
    if (typeof el === 'string')
        return rootEl.matches(el) ? rootEl : rootEl.querySelector(el)
    else
        return el
}

const STATES = {
    INACTIVE: 'INACTIVE',
    ACTIVE: 'ACTIVE'
}

class SmoothElement {
    constructor(userOptions, $componentEl) {
        let options = {
            // Element or selector string.
            // By default it is the $componentEl
            el: $componentEl,
            // Valid values: height, width, transform
            property: 'height',
            // Selector string that will emit a transitionend event.
            // Note that you can specify multiple transitionend
            // event emitters through the use of commas.
            transitionEvent: null,
            // Hide scrollbar during transition.
            hideScrollbar: true,
            debug: false,
            ...userOptions
        }
        let properties = this.parsePropertyOption(options.property)
        if (!options.transition) {
            options.transition = properties.map(p => `${p} .5s`).join(',')
        }

        let internal = {
            $componentEl,
            // Resolved Element from el
            $smoothEl: null,
            // Resolved properties from property
            properties,
            beforeRect: {},
            afterRect: {},
            state: STATES.INACTIVE,
            isRemoved: false
        }
        Object.assign(this, { options }, internal)

        this.endListener = this.endListener.bind(this)
    }
    transitionTo(to) {
        this.state = to
    } /**
     *
     * @param {String|Array} property
     */
    parsePropertyOption(property) {
        let properties = []
        if (typeof property === 'string') {
            properties.push(property)
        } else if (Array.isArray(property)) {
            properties = property
        }
        return properties
    }
    // Retrieve registered element on demand
    // El could have been hidden by v-if/v-show
    findRegisteredEl() {
        let { $componentEl, options } = this
        // $componentEl could be hidden by v-if
        if (!$componentEl) {
            return null
        }
        return select($componentEl, options.el)
    } // Save the DOM properties of the $smoothEl
    // before the data update
    setBeforeValues() {
        let $smoothEl = this.findRegisteredEl()

        // This property could be set by a previous update
        // Reset it so it doesn't affect the current update
        this.afterRect = {}

        let beforeRect = {}
        if ($smoothEl) {
            beforeRect = $smoothEl.getBoundingClientRect()
        }
        this.beforeRect = beforeRect

        if (this.state === STATES.ACTIVE) {
            this.stopTransition()
            this.debug('Transition was interrupted.')
        }
    }
    didValuesChange(beforeRect, afterRect) {
        let b = beforeRect
        let a = afterRect
        for (let prop of this.properties) {
            if (prop === 'transform' &&
                    (b['top'] !== a['top'] || b['left'] !== a['left'])) {
                return true
            } else if (b[prop] !== a[prop]) {
                return true
            }
        }
        return false
    }
    doSmoothReflow(event = 'data update') {
        let $smoothEl = this.findRegisteredEl()
        if (!$smoothEl) {
            this.debug("Could not find registered el.")
            this.transitionTo(STATES.INACTIVE)
            return
        }
        // A transition is already occurring, don't interrupt it.
        if (this.state === STATES.ACTIVE) {
            return
        }
        let { beforeRect, properties, options } = this

        this.$smoothEl = $smoothEl
        this.transitionTo(STATES.ACTIVE)

        let triggeredBy = (typeof event === 'string') ? event : event.target
        this.debug(`Reflow triggered by:`, triggeredBy)

        let afterRect = $smoothEl.getBoundingClientRect()
        this.afterRect = afterRect

        if (!this.didValuesChange(beforeRect, afterRect)) {
            this.debug(`Property values did not change.`)
            this.transitionTo(STATES.INACTIVE)
            return
        }
        this.debug('beforeRect', beforeRect)
        this.debug('afterRect', afterRect)

        let computedStyle = window.getComputedStyle($smoothEl)

        if (options.hideScrollbar) {
            //save overflow properties before overwriting
            let overflowY = computedStyle.overflowY,
                overflowX = computedStyle.overflowX

            this.overflowX = overflowX
            this.overflowY = overflowY

            $smoothEl.style.overflowX = 'hidden'
            $smoothEl.style.overflowY = 'hidden'
        }

        for (let prop of properties) {
            if (prop === 'transform') {
                let invertLeft = beforeRect['left'] - afterRect['left']
                var invertTop = beforeRect['top'] - afterRect['top']
                $smoothEl.style.transform = `translate(${invertLeft}px, ${invertTop}px)`
            } else {
                $smoothEl.style[prop] = beforeRect[prop] + 'px'
            }
        }

        $smoothEl.offsetHeight // Force reflow

        let t = [computedStyle.transition, options.transition].filter(d=>d).join(',')
        $smoothEl.style.transition = t

        for (let prop of properties) {
            if (prop === 'transform') {
                $smoothEl.style.transform = ''
            } else {
                $smoothEl.style[prop] = afterRect[prop] + 'px'
            }
        }
    }
    endListener(event) {
        let { $smoothEl } = this
        let $targetEl = event.target
        let { properties } = this
        // Transition on smooth element finished
        if ($smoothEl === $targetEl) {
            // The transition property is one that was registered
            if (properties.includes(event.propertyName)) {
                this.stopTransition()
                // Record the height AFTER the data change, but potentially
                // BEFORE any transitionend events.
                // Useful for cases like transition mode="out-in"
                this.setBeforeValues()
            }
        }
        else if (this.isRegisteredEventEmitter($smoothEl, event)) {
            this.doSmoothReflow(event)
        }
    } // Check if we should perform doSmoothReflow()
    // after a transitionend event.
    isRegisteredEventEmitter($smoothEl, event) {
        let $targetEl = event.target
        let { transitionEvent } = this.options
        if (transitionEvent === null || Object.keys(transitionEvent).length === 0) {
            return false
        }

        let { selector, propertyName } = transitionEvent
        if (propertyName != null && propertyName !== event.propertyName) {
            return false
        }
        // coerce type to also check for undefined.
        if (selector != null && !$targetEl.matches(selector)) {
            return false
        }

        // If the $smoothEl hasn't registered 'transform'
        // then we don't need to act on transitionend
        // events that occur outside the $smoothEl
        if (this.properties.indexOf('transform') === -1) {
            // Checks if $targetEl IS or WAS a descendent
            // of $smoothEl.
            let smoothElContainsTarget = false
            // composedPath is missing in ie/edge of course.
            let path = event.composedPath ? event.composedPath() : []
            for (let el of path) {
                if ($smoothEl === el) {
                    smoothElContainsTarget = true
                    break
                }
            }
            if (!smoothElContainsTarget) {
                return false
            }
        }
        return true
    }
    stopTransition() {
        let {
            $smoothEl, options, overflowX, overflowY,
            properties,
        } = this
        // Change prop back to auto
        for (let prop of properties) {
            $smoothEl.style[prop] = null
        }
        if (options.hideScrollbar) {
            // Restore original overflow properties
            $smoothEl.style.overflowX = overflowX
            $smoothEl.style.overflowY = overflowY
        }
        // Clean up inline transition
        $smoothEl.style.transition = null

        this.transitionTo(STATES.INACTIVE)
    }
    scheduleRemoval() {
        this.isRemoved = true
    }
    debug(...obj) {
        if (!this.options.debug) {
            return
        }
        console.log(`VSR_DEBUG:`, ...obj)
    }
}

export default mixin
