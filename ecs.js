

class System {

    time = 0

    constructor(ecs) {
        this.ecs = ecs
    }

    tick(delta) {
        const time = new Date().getTime()
        this.tickBefore(delta)
        for(const entity of this.ecs.entities) {
            this.tickEntity(entity, delta)
        }
        this.tickAfter(delta)
        this.time = new Date().getTime() - time
    }

    tickBefore(delta) {}
    tickAfter(delta) {}
    tickEntity(entity, delta) {}
    init() {}
    get log() {}

}



class Ecs {

    entities = []
    components = {}
    systems = []
    currentId = 0
    lastTimestamp = new Date().getTime()
    
    createEntity(components) {
        const entity = this.currentId++
        this.entities.push(entity)
        for(const [name, data] of Object.entries(components)) {
            this.setComponent(entity, name, data)
        }
        return entity
    }

    removeEntity(entity) {
        this.entities = this.entities.filter(e => e !== entity)
        for(const name of Object.keys(this.components)) {
            this.removeComponent(entity, name)
        }
    }

    declareComponent(name) {
        if(!this.components[name]) {
            this.components[name] = {}
        }
    }

    getComponent(entity, name) {
        this.declareComponent(name)
        return this.components[name][entity]
    }

    setComponent(entity, name, data) {
        this.declareComponent(name)
        this.components[name][entity] = data
    }

    removeComponent(entity, name) {
        this.declareComponent(name)
        const component = this.components[name][entity]
        if(component && component.onRemove) {
            component.onRemove()
        }
        delete this.components[name][entity]
    }

    declareSystem(system) {
        this.systems.push(system)
        return system
    }

    tick(delta) {
        for(const system of this.systems) {
            system.tick(delta)
        }
    }

    loop() {
        const timestamp = new Date().getTime()
        this.tick((timestamp - this.lastTimestamp)/1000)
        this.lastTimestamp = timestamp
        window.requestAnimationFrame(() => this.loop())
    }

    start() {
        window.requestAnimationFrame(() => this.loop())
    }

    init() {
        for(const system of this.systems) {
            system.init()
        }
    }

    toJSON() {
        return {
            entities: this.entities,
            components: this.components,
        }
    }

}
