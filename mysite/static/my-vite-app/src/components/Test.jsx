import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Modal, Button } from 'react-bootstrap';
import { useCookies } from 'react-cookie';

const Test = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [tests, setTests] = useState([]);
  const [testQuestions, setTestQuestions] = useState({ questions: [], optionsMap: {} });
  const [userInputs, setUserInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTestId, setActiveTestId] = useState(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isCorrect, setIsCorrect] = useState(null);
  const [currentCorrectAudioIndex, setCurrentCorrectAudioIndex] = useState(0);
  const [currentWrongAudioIndex, setCurrentWrongAudioIndex] = useState(0);
  const [recordMessage, setRecordMessage] = useState('');
  const [cookies, setCookie, removeCookie] = useCookies(['csrftoken']);
  const [correctAnswerKey, setCorrectAnswerKey] = useState('');
  const [randomizedValues, setRandomizedValues] = useState({});
  const [randomizedOptions, setRandomizedOptions] = useState({});
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(false);
  const [isRecordDisabled, setIsRecordDisabled] = useState(false);
  const [volume, setVolume] = useState(0.7);

  const correctAudioUrls = window.correctAudioUrls;
  const wrongAudioUrls = window.wrongAudioUrls;



  useEffect(() => {
    // Fetch classrooms
    axios.get('/api/classrooms/my-classroom/')
      .then(response => {
        setClassrooms(response.data);
        const initialFormData = {};
        response.data.forEach(classroom => {
          initialFormData[classroom.id] = {
            name: '',
            test_picture: null,
          };
          // Fetch tests for each classroom
          fetchTestsByClassroom(classroom.id);
        });
        setFormData(initialFormData);
      })
      .catch(error => {
        console.error('Error fetching classrooms:', error);
      });
  }, []);

  const fetchTestsByClassroom = (classroomId) => {
    axios.get(`/api/name-id-tests/`)
      .then(response => {
        setTests(prevTests => ({
          ...prevTests,
          [classroomId]: response.data,
        }));
      })
      .catch(error => {
        console.error(`Error fetching tests for classroom ${classroomId}:`, error);
      });
  };

  const fetchTestQuestionsAndOptions = async (testId) => {
    try {
      setLoading(true);
      setError(null);

      const testQuestionsResponse = await axios.get(`/api/test-questions/by-test/${testId}/`);
      const questions = testQuestionsResponse.data;

      const optionsPromises = questions.map(async (question) => {
        const optionsResponse = await axios.get(`/api/options/by-question/${question.id}/`);
        return { questionId: question.id, options: optionsResponse.data };
      });

      const optionsResults = await Promise.all(optionsPromises);

      const optionsMap = optionsResults.reduce((acc, { questionId, options }) => {
        acc[questionId] = options;
        return acc;
      }, {});

      setTestQuestions({ questions, optionsMap });
      setLoading(false);

      const randomizedValues = questions.reduce((acc, question) => {
        const keys = Object.keys(question.question_list);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const randomValue = question.question_list[randomKey];

        let randomAlphabetSliced = null;
        if (question.first_letter) {
          randomAlphabetSliced = `_${randomKey.slice(1)}`;
        } else if (question.second_letter) {
          randomAlphabetSliced = `${randomKey[0]}_${randomKey.slice(2)}`;
        } else if (question.third_letter) {
          randomAlphabetSliced = `${randomKey.slice(0, 2)}_${randomKey.slice(3)}`;
        } else if (question.last_letter) {
          randomAlphabetSliced = `${randomKey.slice(0, randomKey.length - 1)}_`;
        }


        acc[question.id] = {
          randomAlphabetSliced : randomAlphabetSliced,
          randomAlphabet: randomKey || null,
          randomUrl: randomValue || null,
          randomWord: randomValue.word || null,
          randomPicture: randomValue.picture || null,
          randomSound: randomValue.sound || null,
        };

        return acc;
      }, {});



      setRandomizedValues(randomizedValues);

      const randomizedOptions = questions.reduce((acc, question) => {
        const options = optionsMap[question.id];
        const optionKeys = options ? Object.keys(options[0].option_list) : [];
        const selectedKeys = new Set();

        const randomizedOptionsForQuestion = options.map((option) => {
          let randomOptionKey;
          do {
            randomOptionKey = optionKeys[Math.floor(Math.random() * optionKeys.length)];
          } while (randomOptionKey === randomizedValues[question.id].randomAlphabet || selectedKeys.has(randomOptionKey));

          selectedKeys.add(randomOptionKey);
          return { ...option, randomOptionKey };
        });

        acc[question.id] = randomizedOptionsForQuestion;
        return acc;
      }, {});

      setRandomizedOptions(randomizedOptions);

    } catch (error) {
      console.error('Error fetching test questions and options:', error);
      setError('Failed to fetch test questions and options.');
      setLoading(false);
    }
  };

  const recordTestScore = async (testId) => {
    setIsRecordDisabled(true);
    try {
      const csrfToken = cookies.csrftoken;
      const response = await axios.post(`/test/${testId}/record/`, null, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          'X-CSRFToken': csrfToken
        }
      });
      const message = response.data.message;
      setRecordMessage(message);
      setShowModal(true);
    } catch (error) {
      console.error('Error recording test score:', error);
      setError('Failed to record test score.');
      setIsRecordDisabled(false);
    }
  };

  const deleteSubmissions = async () => {
    try {
      const csrfToken = cookies.csrftoken;
      await axios.post('/submissions/delete/', null, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          'X-CSRFToken': csrfToken
        }
      });
    } catch (error) {
      console.error('Error deleting submissions:', error);
      setError('Failed to delete submissions.');
    }
  };

  const toggleQuestionDetails = async (testId) => {
    await deleteSubmissions();
    setIsRecordDisabled(false);

    if (activeTestId === testId) {
      setActiveTestId(null);
    } else {
      try {
        setActiveTestId(testId);
        setActiveQuestionIndex(0);
        await fetchTestQuestionsAndOptions(testId);
      } catch (error) {
        console.error('Error fetching test questions and options:', error);
        setError('Failed to fetch test questions and options.');
      }
    }
  };


  const handleSubmit = async (e, questionId, optionId, randomAlphabet, randomAlphabetSliced, randomUrl, randomWord, randomPicture, randomSound) => {
    e.preventDefault();

    let selectedOption = e.target[`selected_option_${questionId}`].value;

    if (selectedOption === randomAlphabet) {
      selectedOption = optionId;
    } else if (isNaN(selectedOption)) {
      selectedOption = '10000000000000000';
    }


    const csrfToken = cookies.csrftoken;
    setIsSubmitDisabled(true);

    try {
      const response = await axios.post(
        `/test/${activeTestId}/question/${questionId}/submit/`,
        { selected_option: selectedOption },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            'X-CSRFToken': csrfToken
          }
        }
      );

      const message = response.data.message;
      setModalMessage(message);
      setShowModal(true);
      setCorrectAnswerKey(randomAlphabet);
      setTimeout(() => setIsSubmitDisabled(false), 1000);

      let audioUrl, audioElement;
      if (message === 'Correct answer') {
        setIsCorrect(true);
        setCurrentWrongAudioIndex(0);
        audioUrl = currentCorrectAudioIndex >= 9
          ? correctAudioUrls[9]
          : correctAudioUrls[currentCorrectAudioIndex];
        audioElement = new Audio(audioUrl);
        setCurrentCorrectAudioIndex((prevIndex) => {
          const newIndex = (prevIndex + 1);
          return newIndex;
        });
      } else {
        setIsCorrect(false);
        setCurrentCorrectAudioIndex(0);
        audioUrl = wrongAudioUrls[currentWrongAudioIndex];
        audioElement = new Audio(audioUrl);
        setCurrentWrongAudioIndex((prevIndex) => {
          const newIndex = (prevIndex + 1) < wrongAudioUrls.length ? (prevIndex + 1) : prevIndex;
          return newIndex;
        });
      }

      audioElement.volume = volume;
      audioElement.play();

      setActiveQuestionIndex((prevIndex) => prevIndex + 1);
    } catch (error) {
      console.error('Error submitting answer:', error);
      setIsSubmitDisabled(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalMessage('');
    setRecordMessage('');  // Reset recordMessage state when closing the modal
  };







  const renderForm = (question, optionsMap, randomAlphabet, randomAlphabetSliced, selectedKeys, randomUrl, randomWord, randomPicture, randomSound) => {
    const options = randomizedOptions[question.id];
    if (!options) return null;
    const optionId = options.length === 1 ? options[0].id : null;

    return (
      <form className="test-form" onSubmit={(e) => handleSubmit(e, question.id, optionId, randomAlphabet, randomAlphabetSliced, randomUrl, randomWord, randomPicture, randomSound)}>
        <div className="container-fluid">
          <div className="row">
            {options.map(option => {
              return (
                <div className="col-md-6" key={option.id}>
                  {question.write_answer ? (
                    <>
                    {(question.first_letter || question.second_letter || question.third_letter || question.last_letter) ? (
                      <div>
                        <span style={{ fontSize: '50px' }}>{randomAlphabetSliced}</span>
                        <p>上の言葉を完成させてください</p>
                      </div>
                    ) : null}
                    <input
                      type="text"
                      id={`selected_option_${question.id}_${option.id}`}
                      name={`selected_option_${question.id}`}
                      style={{ width: '300px', height: '50px', marginTop: '20px' }}
                    />
                    </>
                  ) : (
                    <>
                      {option.option_list[option.randomOptionKey]?.picture ? (
                        <img
                          style={{ width: '150px', height: '120px', marginTop: '8px', border: '3px solid black' }}
                          src={option.is_correct ? randomPicture : option.option_list[option.randomOptionKey].picture}
                          alt="Option"
                        />
                      ): null}
                      <label htmlFor={`selected_option_${question.id}_${option.id}`}   style={{ fontSize: '25px', marginBottom: '10px'}}>
                        <input
                          type="radio"
                          id={`selected_option_${question.id}_${option.id}`}
                          name={`selected_option_${question.id}`}
                          value={option.id}
                          style={{ height: '25px', width: '25px', marginRight: '10px' }}
                        />
                        {(option.option_list[option.randomOptionKey]?.word === undefined) ? (
                          option.is_correct ? randomAlphabet : option.randomOptionKey ? option.randomOptionKey : option.name
                        ): null}
                      </label>
                      {option.option_list[option.randomOptionKey].word ? (
                        <h4>{option.is_correct ? randomWord : option.option_list[option.randomOptionKey].word}</h4>
                      ): null}
                      {option.option_picture && (
                        <img
                          style={{ width: '100px', height: '100px', marginTop: '8px', border: '3px solid black' }}
                          src={Object.keys(option.option_list).length === 0 ? option.option_picture : null}
                          alt="Option"
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <button
          id="submit-btn"
          type="submit"
          className="btn btn-primary"
          style={{
            border: '4px solid #343a40',
            width: '400px',
            height: '80px',
            marginTop: '50px'
          }}
          disabled={isSubmitDisabled}
        >
          回答する
        </button>
      </form>
    );
  };


  return (
    <div>
      <div className="quiz-container d-flex justify-content-center align-items-center" id="quiz" style={{ height: activeTestId ? '100vh' : 'auto', overflowY: 'auto' }}>
        <div className="quiz-header">
          <div>
            {loading && <p>Loading...</p>}
            {error && <p>{error}</p>}
            {classrooms.map(classroom => (
              <div key={classroom.id}>
                <div className="test-buttons-container" style={{ display: 'flex', flexWrap: 'wrap' }}>
                {tests[classroom.id] && tests[classroom.id].map(test => (
                    <span key={test.id} style={{ marginRight: '10px' }}>
                    {activeTestId !== null ? (
                      <h2 style={{ display: 'flex', flexWrap: 'wrap' }}>
                        <button
                          className={`btn btn-warning mb-3 toggle-test-btn ${activeTestId === test.id || activeTestId === null ? 'active' : 'd-none'}`}
                          style={{ height: '50px', width: '290px', padding: '10px', border: '5px solid black', position: 'relative', marginBottom: '10px' }}
                          onClick={() => toggleQuestionDetails(test.id)}
                        >
                          <span
                            className="text-center text-white"
                            style={{ background: 'rgba(0, 0, 0, 0.5)', padding: '5px', borderRadius: '5px', marginBottom: '10px' }}
                          >
                            {test.name}から戻る
                          </span>
                        </button>
                      </h2>
                    ) : (
                      <button
                        className={`btn btn-warning mb-3 toggle-test-btn ${activeTestId === test.id || activeTestId === null ? 'active' : 'd-none'}`}
                        style={{ height: '200px', width: '200px', padding: '10px', border: '5px solid black' }}
                        onClick={() => toggleQuestionDetails(test.id)}
                      >
                        <span
                          className="text-center text-white"
                          style={{ background: 'rgba(0, 0, 0, 0.5)', padding: '5px', borderRadius: '5px', marginBottom: '10px', justifyContent: 'center' }}
                        >
                      　　{test.name}
                        </span>
                        {test.test_picture && (
                          <img src={test.test_picture} alt="Question" width="150" height="150" />
                        )}
                      </button>
                    )}
                    </span>
                ))}
                </div>
                {activeTestId && (
                  <div className="test-details">
                    <ul>
                      {testQuestions.questions.map((question, index) => {
                        const { randomAlphabetSliced, randomAlphabet, randomUrl, randomWord, randomPicture, randomSound} = randomizedValues[question.id] || {};
                        let selectedKeys = [];
                        const isAudio = typeof randomUrl === 'string' && randomUrl.includes('Record');
                        const isPicture = typeof randomUrl === 'string' && randomUrl.includes('image');
                        return (
                          <li key={question.id} className={index === activeQuestionIndex ? 'active' : 'd-none'}>
                          {isPicture ? (
                            <img src={randomUrl} alt="Question" width="200" height="150" />
                          ) : isAudio ? (
                            <audio controls src={randomUrl}>
                              Your browser does not support the audio element.
                            </audio>
                          ) : randomSound? (
                            <audio controls src={randomSound}>
                              Your browser does not support the audio element.
                            </audio>
                          ) : (
                            <p style={{ fontSize: '50px' }}>{randomUrl}</p>
                          )}
                            {renderForm(question, testQuestions.optionsMap, randomAlphabet, randomAlphabetSliced, selectedKeys, randomUrl, randomWord, randomPicture, randomSound)}
                          </li>
                        );
                      })}
                      {testQuestions.questions.length > 0 && !testQuestions.questions.some((_, index) => index === activeQuestionIndex) && (
                          <button
                              className="btn btn-primary mb-3"
                              style={{ width: '200px', height: '50px', margin: '10px' }}
                              onClick={() => recordTestScore(activeTestId)}
                              disabled={isRecordDisabled}
                          >
                          点数を記録する
                          </button>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          <div className="volume-control">
            <label htmlFor="volume-slider" style={{ fontSize: '20px' }}>
              イバルの声の音量調整
            </label>
            <input
              id="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{ width: '200px' }}
            />
          </div>
          </div>
        </div>
      </div>

      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header
          style={{
            backgroundImage:
                currentCorrectAudioIndex >= 9 || recordMessage
                ? `url(${window.staticFileUrl})`
                : currentCorrectAudioIndex === 1 || currentCorrectAudioIndex === 2 || currentCorrectAudioIndex === 3
                ? `url(${window.staticFileUrl3})`
                : currentCorrectAudioIndex === 4
                ? `url(${window.staticFileUrl1})`
                : currentWrongAudioIndex
                ? `url(${window.staticFileUrl4})`
                : `url(${window.staticFileUrl2})`,


            backgroundSize: 'contain', // Ensure the whole image fits within the header
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            height: '50vh' // Set the height of the header
          }}
        >
        </Modal.Header>
        <Modal.Body>
            {recordMessage ? (
                <div className="d-flex align-items-center justify-content-center">
                    <h2 className="message">{recordMessage}</h2>
                </div>
            ) : (
                <>
                <div className="d-flex align-items-center">
                    {isCorrect === true ? (
                        <>
                            <span style={{ fontSize: '50px' }}>正解！</span>
                            <span className="text-success" style={{ fontSize: '50px' }}>&#x2713;</span>
                        </>
                    ) : isCorrect === false ? (
                        <div>
                            <span style={{ fontSize: '50px' }}>あまい！</span>
                            <span className="text-danger" style={{ fontSize: '50px' }}>&#x2717;</span>
                            <h1>正解は：{correctAnswerKey}</h1>
                        </div>
                    ) : null}
                </div>
                <h1>連続正解: {currentCorrectAudioIndex}</h1>
                </>
            )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            Next!
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Test;