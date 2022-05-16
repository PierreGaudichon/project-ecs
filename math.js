
const PI = Math.PI

function rand(a, b) {
    return a + Math.random() * (b - a)
}


class Vector {

    static get origin() { return new Vector(0, 0) }

    static polar(r, t) {
        return new Vector(r * Math.cos(t), r * Math.sin(t))
    }

    constructor(x, y) {
        this.x = x
        this.y = y
        this.r = Math.sqrt(x * x + y * y)
        this.t = Math.atan2(y, x)
    }

    add(vect) {
        return new Vector(this.x + vect.x, this.y + vect.y)
    }

    minus(vect) {
        return new Vector(this.x - vect.x, this.y - vect.y)
    }

    times(k) {
        return new Vector(this.x * k, this.y * k)
    }

    flipY() {
        return new Vector(this.x, -this.y)
    }

    toJSON() {
        return { x: this.x, y: this.y }
    }

}