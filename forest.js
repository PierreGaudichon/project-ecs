

// ----------------------------------------------------------------------------
//
// DECLARATIONS
//
// ----------------------------------------------------------------------------


//
// Components
//

const TYPE = "type" // "player" | "splash" | "tree" | "fox" | "frog"

const POSITION = "position" // Vector

const SPEED = "speed" // number, px per second

const GOAL = "goal" // null | Vector

const DRIFT = "drift" /* {
    speed: number, px per second
    angle: number, in rad
    ttl: number in second
} */

const SHAPE = "shape" /* {
    radius: number
} */

const FIRE = "fire" /* {
    status: "idle" | "fire" | "dead"
    ttl: number, in sec
} */

const VIEW = "view" /* {
    element: DOMElement
    onRemove: () => void
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
            nbEntities: this.ecs.entities.length,
            times: Object.fromEntries(this.ecs.systems.map(system => (
                [system.constructor.name, system.time]
            ))),
            systems: Object.fromEntries(this.ecs.systems.map(system => (
                [system.constructor.name, system.log]
            )))
        }, null, '\t')
    }

}


class Viewer extends System {

    constructor(ecs) {
        super(ecs)
        this.view = null
    }

    getColor(entity) {
        const type = this.ecs.getComponent(entity, TYPE)
        if(type) {
            switch(type) {
                case "player": return "blue"
                case "splash": return "dodgerblue"
                case "frog": return "green"
                case "fox": return "orange"
                case "tree": {
                    const fire = this.ecs.getComponent(entity, FIRE)
                    switch(fire.status) {
                        case "idle": return "lightgreen"
                        case "fire": return "red"
                        case "dead": return "black"
                    }
                }
            }
        }
    }

    tickEntity(entity, delta) {
        const shape = this.ecs.getComponent(entity, SHAPE)
        let view = this.ecs.getComponent(entity, VIEW)
        if(shape && !view) {
            const element = document.createElement("div")
            element.classList.add("entity-view")
            element.id = "entity-view-" + entity
            this.view.appendChild(element)
            element.style.height = shape.radius + "px"
            element.style.width = shape.radius + "px"
            element.style["margin-left"] = (-(shape.radius / 2)) + "px"
            element.style["margin-bottom"] = (-(shape.radius / 2)) + "px"
            element.style['border-radius'] = (shape.radius / 2) + "px"
            view = { element, onRemove: () => { element.remove() } }
            this.ecs.setComponent(entity, VIEW, view)
        }
        const position = this.ecs.getComponent(entity, POSITION)
        if(position) {
            view.element.style.left = position.x + "px"
            view.element.style.bottom = position.y + "px"
            view.element.style['background-color'] = this.getColor(entity)
        }
    }

    init() {
        this.view = document.querySelector("#view")
    }

}


class Mover extends System {

    constructor(ecs, player) {
        super(ecs)
        this.player = player
    }

    tickEntity(entity, delta) {
        const position = this.ecs.getComponent(entity, POSITION)
        const speed = this.ecs.getComponent(entity, SPEED)
        const goal = this.ecs.getComponent(entity, GOAL)
        if(position && speed && goal) {
            const direction = goal.minus(position)
            const normalizedSpeed = speed * delta
            const velocity = Vector.polar(normalizedSpeed, direction.t)
            const newPosition = position.add(velocity)
            if(newPosition.minus(goal).r < normalizedSpeed) {
                this.ecs.setComponent(entity, POSITION, goal)
                this.ecs.setComponent(entity, GOAL, null)
                this.ecs.setComponent(entity, DRIFT, PLAYER_DRIFT())
            } else {
                this.ecs.setComponent(entity, POSITION, newPosition)
            }
        }
    }

    init() {
        document.body.addEventListener('click', (event) => {
            let origin = new Vector(window.innerWidth, window.innerHeight).times(0.5)
            const mouse = new Vector(event.clientX, event.clientY)
            const position = mouse.minus(origin).flipY()
            for(const entity of this.ecs.entities) {
                const goal = this.ecs.getComponent(entity, GOAL)
                if(goal !== undefined) {
                    this.ecs.setComponent(entity, GOAL, position)
                    this.ecs.removeComponent(entity, DRIFT)
                }
            }
        })
    }
}


const PLAYER_DRIFT = () => ({ speed: rand(15, 25), angle: rand(0, 2 * PI), ttl: rand(1, 2) })
const FOX_DRIFT = () => ({ speed: 50, angle: rand(0, 2 * PI), ttl: rand(2, 3) })
const FROG_DRIFT = () => ({ speed: 10, angle: rand(0, 2 * PI), ttl: rand(0.5, 1) })


class Drifter extends System {

    getDrift(entity) {
        const type = this.ecs.getComponent(entity, TYPE)
        switch(type) {
            case "player": return PLAYER_DRIFT()
            case "fox": return FOX_DRIFT()
            case "frog": return FROG_DRIFT()
        }
    }

    tickEntity(entity, delta) {
        const position = this.ecs.getComponent(entity, POSITION)
        const drift = this.ecs.getComponent(entity, DRIFT)
        if(position && drift) {
            const velocity = Vector.polar(drift.speed * delta, drift.angle)
            this.ecs.setComponent(entity, POSITION, position.add(velocity))
            const ttl = drift.ttl - delta
            if(ttl < 0) {
                this.ecs.setComponent(entity, DRIFT, this.getDrift(entity))
            } else {
                this.ecs.setComponent(entity, DRIFT, { ...drift, ttl })
            }
        }
    }

}


class WindowClipper extends System {

    tickEntity(entity, delta) {
        const position = this.ecs.getComponent(entity, POSITION)
        const height = window.innerHeight
        const width = window.innerWidth
        if(position) {
            let x = position.x
            let y = position.y
            if(x < (-width/2)) { x += width }
            if(x > width/2) { x -= width }
            if(y < (-height/2)) { y += height }
            if(y > height/2) { y -= height }
            this.ecs.setComponent(entity, POSITION, new Vector(x, y))
        }
    }

}


const TREES_RATE = 1 // new trees per second

class TreeSpawner extends System {

    spawnTree() {
        this.ecs.createEntity({
            [TYPE]: "tree",
            [POSITION]: randWindow(),
            [SHAPE]: { radius: rand(18, 24) },
            [FIRE]: { status: "idle", ttl: rand(1, 400) }
        })
    }

    tickBefore(delta) {
        if(rand(0, 1) < delta * TREES_RATE) {
            this.spawnTree()
        }
    }

    init() {
        for(let j = 8; j < 300; j++) {
            this.spawnTree()
        }
    }

    get log() {
        const idle = this.ecs.entities.filter(e => {
            const fire = this.ecs.getComponent(e, FIRE)
            return fire && fire.status === "idle"
        }).length
        const fire = this.ecs.entities.filter(e => {
            const fire = this.ecs.getComponent(e, FIRE)
            return fire && fire.status === "fire"
        }).length
        const dead = this.ecs.entities.filter(e => {
            const fire = this.ecs.getComponent(e, FIRE)
            return fire && fire.status === "dead"
        }).length

        return { idle, fire, dead, total: idle + fire + dead }
    }
}


class Firer extends System {

    tickEntity(entity, delta) {
        const fire = this.ecs.getComponent(entity, FIRE)
        const shape = this.ecs.getComponent(entity, SHAPE)
        if(fire && shape) {
            const ttl = fire.ttl - delta
            if(ttl < 0) {
                if(fire.status === "idle") {
                    this.ecs.setComponent(entity, FIRE, { status: "fire", ttl: 10 })
                    this.ecs.setComponent(entity, SHAPE, { ...shape, color: "red" })
                } else if(fire.status === "fire") {
                    this.ecs.setComponent(entity, FIRE, { status: "dead", ttl: 2 })
                    this.ecs.setComponent(entity, SHAPE, { ...shape, color: "black" })
                } else {
                    this.ecs.removeEntity(entity)
                }
            } else {
                this.ecs.setComponent(entity, FIRE, { ...fire, ttl })
            }
        }
    }
}


class Extinguisher extends System {

    constructor(ecs, player) {
        super(ecs)
        this.player = player
        this.countdown = 100
        this.saved = 0
    }

    tickEntity(entity, delta) {
        const position = this.ecs.getComponent(entity, POSITION)
        const fire = this.ecs.getComponent(entity, FIRE)
        const player = this.ecs.getComponent(this.player, POSITION)
        if(position && fire && fire.status === "fire" && player && position.minus(player).r < 20) {
            const ttl = rand(5, Math.max(this.countdown--, 10))
            this.ecs.setComponent(entity, FIRE, { status: "idle", ttl })
            this.saved++
            for(let i = 0; i < 30; i++) {
                this.ecs.createEntity({
                    [TYPE]: "splash",
                    [POSITION]: position.add(Vector.polar(rand(5, 20), rand(0, 2*PI))),
                    [SHAPE]: { radius: rand(2, 8) }
                })
            }
        }
    }

    tickAfter() {
        this.element.textContent = this.saved
    }

    init() {
        this.element = document.querySelector("#saved-counter")
    }

    get log() {
        return { countodwn: this.countdown, saved: this.saved }
    }
}

// ----------------------------------------------------------------------------
//
// INITIALIZATION
//
// ----------------------------------------------------------------------------


function randWindow() {
    const height = window.innerHeight
    const width = window.innerWidth
    return new Vector(rand(-width, width), rand(-height, height))
}


window.onload = () => {
    const ecs = new Ecs()

    const player = ecs.createEntity({
        [TYPE]: "player",
        [POSITION]: Vector.origin,
        [SPEED]: 200,
        [GOAL]: null,
        [DRIFT]: PLAYER_DRIFT(),
        [SHAPE]: { radius: 10 }
    })

    for(let i = 0; i < 100; i++) {
        const fox = ecs.createEntity({
            [TYPE]: "fox",
            [POSITION]: randWindow(),
            [DRIFT]: FOX_DRIFT(),
            [SHAPE]: { radius: 6 }
        })
        const frog = ecs.createEntity({
            [TYPE]: "frog",
            [POSITION]: randWindow(),
            [DRIFT]: FROG_DRIFT(),
            [SHAPE]: { radius: 6 }
        })
    }

    ecs.declareSystem(new TreeSpawner(ecs))
    ecs.declareSystem(new Firer(ecs))
    ecs.declareSystem(new Mover(ecs, player))
    ecs.declareSystem(new Drifter(ecs))
    ecs.declareSystem(new WindowClipper(ecs))
    ecs.declareSystem(new Extinguisher(ecs, player))
    ecs.declareSystem(new Viewer(ecs))
    ecs.declareSystem(new Logger(ecs))

    ecs.init()
    ecs.start()
}