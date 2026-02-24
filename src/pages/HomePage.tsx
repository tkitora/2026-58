import { useNavigate } from 'react-router-dom';
import bg from '../assets/nara_bg1.jpg';


function HomePage() {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/MainPage');
  };
  return (
    <>
      <div className="min-h-screen flex justify-center items-center bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      >
        <h1 onClick={handleLogoClick} className="text-white text-6xl font-bold drop-shadow-lg cursor-pointer select-none p-20 bg-gray-700/50 rounded-4xl border-3 border-white ">
          ならげっさー！
        </h1>
      </div>
    </>
  );
}

export default HomePage;