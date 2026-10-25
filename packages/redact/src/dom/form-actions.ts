import { walkRetained } from './walk';
import { syncInputValue, syncTextareaValue, syncSelectValue } from './form-controls';
import { FiberTag, type Fiber } from '../core';
import { runAction } from '../react/action-scope';
import { formState, idleFormStatus, publishForm } from '../react/form-state';
import { getRootContainer } from './root-internal';
const forms = new WeakMap<HTMLFormElement, Fiber>();
const listening = new WeakSet<Node>();
const handled = new WeakSet<Event>();
export const formActions = new WeakMap<Element, (data: FormData) => unknown>();
function resetForm(form: HTMLFormElement, owner: Fiber): void {
    form.ownerDocument.defaultView!.HTMLFormElement.prototype.reset.call(form);
    walkRetained(owner.r!.r, fiber => {
        const props = fiber.m;
        if (fiber.n && props && (fiber.n as HTMLInputElement).form === form) {
            if (fiber.type === 'input')
                syncInputValue(fiber.n as HTMLInputElement, props, props);
            else if (fiber.type === 'textarea')
                syncTextareaValue(fiber.n as HTMLTextAreaElement, props);
            else if (fiber.type === 'select' && props.value != null) {
                const select = fiber.n as HTMLSelectElement;
                syncSelectValue(select, props);
            }
        }
    });
}
export function requestFormReset(form: HTMLFormElement): void {
    const owner = forms.get(form);
    if (!owner || owner.u)
        throw new Error(process.env.NODE_ENV !== 'production' ? 'requestFormReset expects a mounted form rendered by Redact.' : '');
    resetForm(form, owner);
}
export function bindForm(fiber: Fiber, onError: (fiber: Fiber, error: unknown) => void): void {
    const form = fiber.n as HTMLFormElement;
    forms.set(form, fiber);
    const container = getRootContainer(fiber);
    if (listening.has(container))
        return;
    listening.add(container);
    container.addEventListener('submit', event => {
        if (event.defaultPrevented || handled.has(event))
            return;
        const form = event.target as HTMLFormElement;
        const owner = forms.get(form);
        if (!owner || owner.u)
            return;
        const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null;
        const override = submitter?.hasAttribute('formaction') || (submitter && formActions.has(submitter));
        const action = override ? formActions.get(submitter!) : formActions.get(form);
        if (!action)
            return;
        handled.add(event);
        event.preventDefault();
        const data = new FormData(form, submitter);
        const state = formState(owner);
        const generation = ++state.g;
        publishForm(state, { pending: true, data, method: 'post', action });
        const scope = runAction(() => action(data));
        scope.d.then(() => {
            if (owner.u || generation !== state.g)
                return;
            if (!scope.f)
                resetForm(form, owner);
            publishForm(state, idleFormStatus);
            if (scope.f && !scope.h)
                onError(owner, scope.e);
        });
    });
}
