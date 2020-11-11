

// JSX.Element in node_modules/@types/react/index.d.ts:
//
// interface Element extends React.ReactElement<any, any> { }
//
type RElm = JSX.Element;

// Also: type HElm = HTMLElement;


// JSX.ElementClass in node_modules/@types/react/index.d.ts:
//
// interface ElementClass extends React.Component<any> {
//     render(): React.ReactNode;
// }
//
type RElmClass = JSX.ElementClass;
