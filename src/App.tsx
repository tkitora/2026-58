import { HomePage, MainPage, Single, SingleGame, SingleGame_rank } from './index';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <>
      <Router>
        <main>
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='/MainPage' element={<MainPage />} />
            <Route path='/Single' element={<Single />} />
            <Route path='/SingleGame' element={<SingleGame />} />
            <Route path='/SingleGame_rank' element={<SingleGame_rank />} />
          </Routes>
        </main>
      </Router>
    </>
  )
}
export default App