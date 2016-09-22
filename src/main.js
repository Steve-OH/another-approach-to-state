import xs from "xstream";
import {run} from "@cycle/xstream-run";
import isolate from '@cycle/isolate';
import {makeDOMDriver, button, div, input, label, pre} from "@cycle/dom";
import R from 'ramda';

// This is what the app state looks like: a triple of RGB values, along with an
// array of saved RGB triples. Every time one of the color sliders is moved, the
// RGB values are updated to reflect the change. Every time the save button is
// clicked, the current RGB triple is appended to the "saves" array, and the
// RGB values are reset to 0.
const initialState = {
    rgb: {
        r: '0',
        g: '0',
        b: '0',
        },
    saves: [],
}

// Here are some Ramda lenses for accessing components of the state.
const lensRGB = R.lensProp('rgb');
const lensR = R.lensPath(['rgb', 'r']);
const lensG = R.lensPath(['rgb', 'g']);
const lensB = R.lensPath(['rgb', 'b']);
const lensSaves = R.lensProp('saves');

// The following functions are used to interact with the state. First are the
// getters.

// getR() obtains the current R value from the state. Similarly for getG() and
// getB().
function getR(state) {
    return R.view(lensR, state);
}

function getG(state) {
    return R.view(lensG, state);
}

function getB(state) {
    return R.view(lensB, state);
}

// canSave() determines whether or not the current state allows for saves. For
// illustration purposes, canSave() here returns true unless the current color
// is cyan: rgb(0, 255, 255). Any color but cyan!
function canSave(state) {
    return !(getR(state) === "0" && getG(state) === "255" &&
        getB(state) === "255");
}

// Next come the setters. State manipulation is based on the concept of an
// action, which is a function that takes the current state as its argument, and
// returns a new state as its result. Note that the state is persistent: It is
// never mutated; instead, a new state object is created whenever the state is
// to be updated.

// setR() returns an action that sets the R value of the state to the value
// passed as its argument. Similarly for setG() and setB().
function setR(value) {
    return state => R.set(lensR, value, state);
}

function setG(value) {
    return state => R.set(lensG, value, state);
}

function setB(value) {
    return state => R.set(lensB, value, state);
}

// save() returns an action that pushes the current RGB value to the end of the
// "saves" array and clears out the RGB value to (0, 0, 0).
function save() {
    return function(state) {
        const newRGB = R.view(lensRGB, state);
        const saves = R.view(lensSaves, state);
        return R.set(lensSaves, R.append(newRGB, saves), initialState);
    }
}

// Here is our labeled slider component. In addition to the usual properties
// (label, min, max, etc.), it is initialized with a "set" property (which it
// uses to invoke a state action), and a "get" property (which it uses to obtain
// its current value from the state). Note that the component does not maintain
// any internal state; instead, it uses "get" and "set" to interact with
// external state.
function LabeledSlider(sources) {
    const action$ = sources.props
        .map(props => sources.DOM.select(props.selector).events('change')
            .map(ev => props.set(ev.target.value)))
        .flatten();

    const vtree$ = sources.props
        .map(props => div(
            [ label(props.label)
            , input(props.selector,
                {
                    props: {
                        type: 'range',
                        min: props.min,
                        max: props.max,
                        value: props.get,
                    }
                })
            ])
        );

    return {
        DOM: vtree$,
        action: action$
    };
}

// Here is our action button component. In addition to the usual properties, it
// is initialized with a "set" property (which it uses to invoke a state
// action), and a "canAct" property that indicates whether or not the button
// should be enabled.
function ActionButton(sources) {
    const action$ = sources.props
        .map(props => sources.DOM.select(props.selector).events('click')
            .map(ev => props.set()))
        .flatten();

    const vtree$ = sources.props
        .map(props => div(
            [ button(props.selector,
                {
                    props: {
                        disabled: !props.canAct,
                    }
                }, props.caption)
            ])
        );

    return {
        DOM: vtree$,
        action: action$
    };
}

// Here is our display component. It is a "display only" component, so it does
// not return any action stream. It accepts the current set of saves and
// displays them in a set of <pre> tags. Unlike the labeled slider and action
// button components, which are completely generic, this one does have to have
// some knowledge about the structure of the state in order to do its job.
function SavesDisplay(sources) {
    const vtree$ = sources.props
        .map(props => div(props.selector,
            props.saves.map(save => pre(JSON.stringify(save)))));

    return {
        DOM: vtree$,
    };
}

// Finally, the main application code.
function main(sources) {
    // Set up the state update loop.
    const actionProxy$ = xs.create();

    const state$ = actionProxy$
        .fold((state, action) => action(state), initialState);

    // Instantiate all of our components
    const redSlider = isolate(LabeledSlider)({
        DOM: sources.DOM,
        props: state$.map(state => ({
            set: setR,
            label: 'Red',
            selector: '.red',
            min: 0,
            max: 255,
            get: getR(state),
        })),
    });

    const greenSlider = isolate(LabeledSlider)({
        DOM: sources.DOM,
        props: state$.map(state => ({
            set: setG,
            label: 'Green',
            selector: '.green',
            min: 0,
            max: 255,
            get: getG(state),
        })),
    });

    const blueSlider = isolate(LabeledSlider)({
        DOM: sources.DOM,
        props: state$.map(state => ({
            set: setB,
            label: 'Blue',
            selector: '.blue',
            min: 0,
            max: 255,
            get: getB(state),
        })),
    });

    const saveButton = isolate(ActionButton)({
        DOM: sources.DOM,
        props: state$.map(state => ({
            selector: '.save',
            caption: 'Save',
            set: save,
            canAct: canSave(state),
        })),
    });

    const savesDisplay = isolate(SavesDisplay)({
        props: state$.map(state => ({
            selector: '.saves',
            saves: R.view(lensSaves, state),
        })),
    });

    // Close the state update loop.
    const action$ = xs.merge(redSlider.action, greenSlider.action,
        blueSlider.action, saveButton.action);
    actionProxy$.imitate(action$);

    // Constructing the view is straightforward.
    const vtree$ = xs.combine(state$, redSlider.DOM, greenSlider.DOM,
        blueSlider.DOM, saveButton.DOM, savesDisplay.DOM)
        .map(([state, redDOM, greenDOM, blueDOM, saveDOM, savesDOM]) =>
            div(
                [ redDOM
                , greenDOM
                , blueDOM
                , saveDOM
                , savesDOM
                ])
        );

    let sinks = {
        DOM: vtree$,
        state: state$,
    };

    return sinks;
}

let drivers = {
    DOM: makeDOMDriver('#main-view'),
};

run(main, drivers);
