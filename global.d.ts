// animejs 3 tip tanımı içermiyor
declare module 'animejs';

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
