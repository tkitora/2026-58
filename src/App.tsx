import { HomePage, MainPage, Single, SingleGame } from './index';
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
          </Routes>
        </main>
      </Router>
    </>
  )
}
export default App