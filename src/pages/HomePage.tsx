import { useNavigate } from 'react-router-dom';


function HomePage() {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/mainpage');
  };
  return (
    <>
      <div className="min-h-screen flex justify-center items-center bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover"
      >
        <h1 onClick={handleLogoClick} className="text-white text-4xl md:text-6xl font-bold drop-shadow-lg cursor-pointer select-none p-20 m-5 bg-gray-700/50 rounded-4xl border-3 border-white ">
          ならげっさー！
        </h1>
      </div>
    </>
  );
}

export default HomePage;