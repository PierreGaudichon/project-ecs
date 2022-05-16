

// ----------------------------------------------------------------------------
//
// DECLARATIONS
//
// ----------------------------------------------------------------------------


//
// Components
//

const POSITION = "position" // Vector

const ORBIT = "orbit" /* {
    parent: Entity,
    radius: number, // in px
    angle: number, // in rad
    speed: number // full period per sec
} */

const SHAPE = "shape" /* {
    element: Element
    color: string
    radius: number
} */


//
// Systems
//


class Logger extends System {

    deltas = []

    init() {
        this.element = document.querySelector("#debug")
    }

    tickAfter(delta) {
        if(this.deltas.length >= 20) { this.deltas.shift() }
        this.deltas.push(delta)
        this.element.textContent = JSON.stringify({
            delta: Math.round(this.deltas.reduce((a, c) => a + c) / 20 * 1000),
            fps: Math.round(1/delta * 100)/100,
            nbEntities: this.ecs.entities.length,
            times: Object.fromEntries(this.ecs.systems.map(system => (
                [system.constructor.name, system.time]
            ))),
            systems: Object.fromEntries(this.ecs.systems.map(system => (
                [system.constructor.name, system.log]
            )))
        }, null, '\t')
    }

    get log() {}

}


class Orbiter extends System {

    coef = 1
    pause = false

    tickEntity(entity, delta) {
        if(this.pause) { return }
        const orbit = this.ecs.getComponent(entity, ORBIT)
        if(!orbit) { return }
        const newAngle = (orbit.angle + (this.coef * delta * orbit.speed)) % (2 * PI)
        this.ecs.setComponent(entity, ORBIT, { ...orbit, angle: newAngle })
        const parentPosition = this.ecs.getComponent(orbit.parent, POSITION)
        if(!parentPosition) { return }
        const relativePosition = Vector.polar(orbit.radius, newAngle)
        const newPosition = parentPosition.add(relativePosition)
        this.ecs.setComponent(entity, POSITION, newPosition)
    }

    init() {
        const orbiterCoef = document.querySelector("#orbiter-coef")
        orbiterCoef.value = this.coef
        orbiterCoef.addEventListener('change', event => {
            const value = parseFloat(event.target.value)
            this.coef = Math.pow(1.5, value)
        })

        const orbiterPause = document.querySelector("#orbiter-pause")
        orbiterPause.addEventListener('click', (event) => {
            this.pause = !this.pause
            orbiterPause.blur() // On click the button is focused. On space, when the button is focused, it activates it, toggling this.pause twice ^^
        })
        
        document.body.addEventListener('keypress', (event) => {
            if(event.code === "Space") {
                this.pause = !this.pause
            }
        })
    }

    get log() {
        return { coef: this.coef, pause: this.pause }
    }

}


class Viewer extends System {

    constructor(ecs) {
        super(ecs)
        this.view = null
        this.views = {}
    }

    tickEntity(entity, delta) {
        const position = this.ecs.getComponent(entity, POSITION)
        const view = this.views[entity]
        if(position && view) {
            view.style.left = position.x + "px"
            view.style.bottom = position.y + "px"
        }
    }

    init() {
        this.view = document.querySelector("#view")
        for(const entity of this.ecs.entities) {
            const shape = this.ecs.getComponent(entity, SHAPE)
            if(shape) {
                const view = document.createElement("div")
                view.classList.add("entity-view")
                view.id = "entity-view-" + entity
                this.view.appendChild(view)
                this.views[entity] = view
                view.style.height = shape.radius + "px"
                view.style.width = shape.radius + "px"
                view.style["margin-left"] = (-(shape.radius / 2)) + "px"
                view.style["margin-bottom"] = (-(shape.radius / 2)) + "px"
                view.style['border-radius'] = (shape.radius / 2) + "px"
                view.style['background-color'] = shape.color
            }
        }
    }

    get log() {}
}


class Informer extends System {

    constructor(ecs, mouseHover) {
        super(ecs)
        this.element = null
        this.mouseHover = mouseHover
        this.selected = null
    }

    tickEntity(entity, delta) {
        if(this.selected === entity) {
            const result = { entity }
            
            const position = this.ecs.getComponent(entity, POSITION)
            if(position) {
                const x = Math.round(position.x)
                const y = Math.round(position.y)
                result.position = { x, y }
            }
            
            const orbit = this.ecs.getComponent(entity, ORBIT)
            if(orbit) {
                result.orbit = { ...orbit, angle: Math.round(orbit.angle * 100)/100 }
            }

            const shape = this.ecs.getComponent(entity, SHAPE)
            if(shape) {
                result.shape = shape
            }

            this.element.textContent = JSON.stringify(result, null, "\t")
        }
    }

    init() {
        this.element = document.querySelector("#infos")
        document.body.addEventListener('click', () => {
            if(this.mouseHover.closest !== null) {
                this.selected = this.mouseHover.closest
            }
        })
    }

    get log() {
        return { selected: this.selected }
    }
}


class MouseHover extends System {

    constructor(ecs) {
        super(ecs)
        this.mouse = Vector.origin
        this.origin = Vector.origin
        this.closest = 0
    }

    tickBefore() {
        this.closest = this.ecs.entities.find(e => this.ecs.getComponent(e, POSITION))
    }

    tickEntity(entity, delta) {
        const position = this.ecs.getComponent(entity, POSITION)
        if(!position) { return }
        const distance = position.minus(this.mouse)
        let closest = this.ecs.getComponent(this.closest, POSITION)
        closest = closest.minus(this.mouse)
        if(distance.r < closest.r) {
            this.closest = entity
        }
    }

    tickAfter() {
        const position = this.ecs.getComponent(this.closest, POSITION)
        const center = position.flipY().add(this.origin)
        this.crossHorizontal.style.top = center.y + "px"
        this.crossVertical.style.left = center.x + 'px'
    }

    init() {
        this.crossHorizontal = document.querySelector("#cross-horizontal")
        this.crossVertical = document.querySelector("#cross-vertical")
        window.addEventListener("resize", () => {
            this.origin = new Vector(window.innerWidth, window.innerHeight).times(0.5)
        })
        this.origin = new Vector(window.innerWidth, window.innerHeight).times(0.5)
        document.body.addEventListener('mousemove', (event) => {
            const mouse = new Vector(event.clientX, event.clientY)
            this.mouse = mouse.minus(this.origin).flipY()
        })
    }

    get log() {
        return { closest: this.closest }
    }
}



// ----------------------------------------------------------------------------
//
// INITIALIZATION
//
// ----------------------------------------------------------------------------





window.onload = () => {
    const ecs = new Ecs()

    const sun = ecs.createEntity({
        [POSITION]: Vector.origin,
        [SHAPE]: { radius: 50, color: "yellow" }
    })

    const earth = ecs.createEntity({
        [ORBIT]: { parent: sun, radius: 100, angle: 0, speed: 0.5 },
        [SHAPE]: { radius: 10, color: "blue" }
    })

    const moon = ecs.createEntity({
        [ORBIT]: { parent: earth, radius: 10, angle: 0, speed: 2 },
        [SHAPE]: { radius: 4, color: "grey" }
    })

    const mars = ecs.createEntity({
        [ORBIT]: { parent: sun, radius: 150, angle: PI, speed: 1 },
        [SHAPE]: { radius: 8, color: "red" }
    })

    for(let i = 0; i < 2000; i++) {
        ecs.createEntity({
            [ORBIT]: { parent: sun, radius: rand(300, 350), angle: rand(0, 2 * PI), speed: rand(0.1, 0.15) },
            [SHAPE]: { radius: rand(1, 2), color: "black" }
        })
    }
    

    ecs.declareSystem(new Orbiter(ecs))
    ecs.declareSystem(new Viewer(ecs))
    const mouseHover = ecs.declareSystem(new MouseHover(ecs))
    ecs.declareSystem(new Informer(ecs, mouseHover))
    ecs.declareSystem(new Logger(ecs))

    ecs.init()
    ecs.start()

}