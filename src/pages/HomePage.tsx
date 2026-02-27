import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

function HomePage() {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/mainpage');
  };
  return (
    <>
      <div className="min-h-screen flex justify-center items-center bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover"
      >
        <img alt="ロゴ" src={logo} onClick={handleLogoClick} className='animate-logo-sway hover:scale-95 active:scale-90 transition'></img>
      </div>
    </>
  );
}

export default HomePage;