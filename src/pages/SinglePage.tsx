import { useNavigate } from 'react-router-dom';

function Single() {
    const navigate = useNavigate();
    const handleStartClick = () => {
        navigate('/singlegame')
    };
    return(
        <>
            <div>
                <h1>
                    最近のランキング
                </h1>
            </div>
            <p onClick={handleStartClick}>
                スタート
            </p>
        </>
    );
}


export default Single;