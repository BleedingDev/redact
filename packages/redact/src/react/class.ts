import type { ReactNode } from '../core'

type SetStateCallback<S, P> =
  | Partial<S>
  | ((prev: S, props: P) => Partial<S> | null)
  | null

export class Component<P = {}, S = {}> {
  static contextType?: any
  static getDerivedStateFromProps?(props: any, state: any): any
  static getDerivedStateFromError?(error: any): any
  static defaultProps?: any
  static displayName?: string

  props: P
  state: S = {} as S
  context: any
  refs: Record<string, any> = {}

  // Injected by reconciler
  _f: any = null
  _q: ((updater: SetStateCallback<S, P>, cb?: () => void) => void) | null = null
  _u: ((cb?: () => void) => void) | null = null

  constructor(props: P, context?: any) {
    this.props = props
    this.context = context
  }

  setState(updater: SetStateCallback<S, P>, callback?: () => void): void {
    if (!this._q) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('Cannot call setState on an um component.')
      }
      throw new Error()
    }
    this._q(updater, callback)
  }

  forceUpdate(callback?: () => void): void {
    if (!this._u) return
    this._u(callback)
  }

  render(): ReactNode {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('Component subclass must implement render().')
    }
    throw new Error()
  }

  componentDidMount?(): void
  componentDidUpdate?(prevProps: P, prevState: S, snapshot?: any): void
  componentWillUnmount?(): void
  shouldComponentUpdate?(nextProps: P, nextState: S, nextCtx: any): boolean
  getSnapshotBeforeUpdate?(prevProps: P, prevState: S): any
  componentDidCatch?(error: any, info: { componentStack: string }): void
}
;(Component.prototype as any).isReactComponent = {}

export class PureComponent<P = {}, S = {}> extends Component<P, S> {}
;(PureComponent.prototype as any).isPureReactComponent = true
