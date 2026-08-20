const React = require('react');

function makeComponent(name) {
  const Component = React.forwardRef((props, ref) => React.createElement(name, { ...props, ref }));
  Component.displayName = name;
  return Component;
}

const MapView = makeComponent('MapView');
MapView.Animated = makeComponent('AnimatedMapView');

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = makeComponent('Marker');
module.exports.Circle = makeComponent('Circle');
module.exports.Polyline = makeComponent('Polyline');
module.exports.Polygon = makeComponent('Polygon');
module.exports.Callout = makeComponent('Callout');
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.PROVIDER_DEFAULT = 'default';
