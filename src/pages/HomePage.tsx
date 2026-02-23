import { useNavigate } from 'react-router-dom';


function HomePage() {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/MainPage');
  };
  return (
    <div>
      <h1 onClick={handleLogoClick}>
        ならげっさー！
      </h1>
    </div>
  );
}

export default HomePage;