<template>
    <div id="app" class="container">
        <div class="title">
            <h2>Vue smooth reflow</h2>
            <a href="https://github.com/guanzo/vue-smooth-reflow" target="_blank">
                <img class="github-link" src="https://cdnjs.cloudflare.com/ajax/libs/octicons/8.0.0/svg/mark-github.svg">
            </a>
        </div>
        <p>When a change in data causes a reflow, vue smooth reflow (VSR) will transition it for you.</p>
        <p>Why? Because reflows are ugly, and motion is beautiful.</p>
        <p>VSR will transition 3 CSS properties: height, width, and transform.</p>
        <p>Don't hack your CSS just to transition <code>height: auto</code>. Let dynamic content fill the DOM, and VSR will handle the rest.</p>
        <p>Check out each property, toggle VSR off and on, and see what vue smooth reflow does for you.</p>
        <div class="buttons">
            <button
                @click="isVsrActive = !isVsrActive"
                :class="{'button-primary': isVsrActive}"
                class="toggle-vsr">
                VSR is {{ isVsrActive ? 'on' : 'off' }}
            </button>
            <button
                v-for="p in properties"
                @click="currentProp = p"
                :class="{'button-primary': p === currentProp}"
                :key="p"
            >
                {{ p }}
            </button>
        </div>
        <component
            :is="currentProp"
            :isVsrActive="isVsrActive"
            v-bind="vsrData" />
    </div>
</template>

<script>
import Height from './examples/Height'
import Width from './examples/Width'
import Transform from './examples/Transform'
import Combination from './examples/Combination'
import Test from './test/Test'

let { NODE_ENV } = process.env

export default {
    name: 'app',
    data() {
        let properties = ['Height', 'Width', 'Transform', 'Combination']
        if (NODE_ENV === 'development') {
            properties.push('Test')
        }
        return {
            isVsrActive: true,
            currentProp: 'Height',
            properties,
            vsrData: {
                count: 0,
                children: 3,
                childrenMax: 9,
                listChildren: 0,
                listChildrenMax: 3,
                direction: 'up',
            }
        }
    },
    mounted() {
        setInterval(()=>{
            this.vsrData.children = this.vsrData.count%2 == 0 ? this.vsrData.childrenMax : 3
            this.vsrData.count++

            if (this.vsrData.direction === 'up') {
                this.vsrData.listChildren++
                if (this.vsrData.listChildren === this.vsrData.listChildrenMax)
                    this.vsrData.direction = 'down'
            } else {
                this.vsrData.listChildren--
                if (this.vsrData.listChildren === 0)
                    this.vsrData.direction = 'up'
            }
        }, 1500)
    },
    components: {
        Height,
        Width,
        Transform,
        Combination,
        Test
    }
}
</script>

<style lang="scss">
* {
    box-sizing: border-box;
}
body {
    background: #fefefe;
    padding: 3rem;
    overflow-y: scroll;
    font-size: 16px;
    font-family: 'Roboto', sans-serif;
}
.title {
    display: flex;
    align-items: center;
    margin-bottom: 2rem;
    h2 {
        margin-right: 4rem;
        margin-bottom: 0;
    }
    img {
        height: 40px;
        width: 40px;
        cursor: pointer;
    }
}
button {
    font-family : inherit;
}
.buttons {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 30px;
    button {
        margin-right: 5px;
    }
    .toggle-vsr {
        width: 160px;
        margin-right: 50px;
    }
}

.wrapper {
    &.grid {
        display: grid;
        grid-template-rows: auto auto auto;
        grid-template-columns: auto auto auto;
    }
    background: #BBDEFB;
    padding: 2px;
    div {
        background: #2196F3;
        margin: 2px;
        width: 50px;
        height: 50px;
    }
}

.fade-enter-active, .fade-leave-active {
    transition: opacity .85s;
}
.fade-enter, .fade-leave-to {
    opacity: 0;
}
.fade-fast-enter-active, .fade-fast-leave-active {
    transition: opacity .35s;
}
.fade-fast-enter, .fade-fast-leave-to {
    opacity: 0;
}
</style>
