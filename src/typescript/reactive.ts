let inside: (() => void)[] = [];
let nextId = 0;

const deps: {[key: string]: (() => void)[]} = {};

export class ReactiveVar<T> {

    dep: any;
    constructor(private val: T) {}

    get() {
        this.dep.depend();
        return this.val;
    }

    set(val: T) {
        this.val = val;
        this.dep.changed(); 
    }

    update(updater: (val: T) => (T | any)) {
        const result = updater(this.val);
        if (result) {
            this.val = result;
        }
        this.dep.changed();
    }
}

export function timerDependency(milliseconds: number) {
    const dep = createDependency();
    const interval = setInterval(() => {
        dep.changed();
    }, milliseconds); // TODO: clear up at some point
    return dep;
}

export function autorun(run: () => void) {
    inside.push(run);
    run();
    inside.pop();
}

export function createDependency() {
    const id = ++nextId;
    return {
        depend: () => {
            if (deps[id]) return;
            
            if (inside.length === 0) {
                console.warn('Depend called but not inside a reactive context');
                debugger;
            }

            deps[id] = (deps[id] || []).concat(inside[inside.length - 1]);
        },
        changed: () => {
            if (deps[id]) {
                deps[id].forEach(d => d());
            }
        },
        remove: () => {
            delete deps[id];
        }
    };
}