import PropTypes from 'prop-types';

// ตัวอย่างการใช้ PropTypes
const MyComponent = ({ onBack, title, children }) => {
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={onBack}>Back</button>
      {children}
    </div>
  );
};

MyComponent.propTypes = {
  onBack: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node
};

export default MyComponent;
