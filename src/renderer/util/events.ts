import * as _ from 'underscore'

interface EventHandle {
    stop: () => void
}
type EventCallback<T> = (eventVal: T) => void;   

export class EventSource<T> {
    private nextId = 0;
    private listenersById: {[id: string]: EventCallback<any>} = {};

    listen(callback: EventCallback<T>) : EventHandle {
        const thisId = ++this.nextId;
        this.listenersById[thisId] = callback;
        
        return {
            stop: () => {delete this.listenersById[thisId]}
        }
    }

    message(value: T) {
        _.values(this.listenersById).forEach(listener => listener(value));
    }
}