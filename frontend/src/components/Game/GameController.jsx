import GamePage from "pages/GamePage";
import LobbyPage from "pages/LobbyPage";
import MyButton from "components/common/Button";

import { OpenVidu } from "openvidu-browser";
import React, { useCallback } from "react";
import { useState } from "react";
import { useSelector } from "react-redux";

import axios from "axios";
import styled from "styled-components";

const SessionIdDiv = styled.div`
  display: flex;
  justify-content: space-between;
  color: white;
`;

const APPLICATION_SERVER_URL = "https://i8d205.p.ssafy.io/api/rooms/";
const temp = localStorage.getItem("persist:root");
let token = "";

if (temp) {
  const temp2 = JSON.parse(temp);
  const temp3 = JSON.parse(temp2.auth);
  token = temp3.token;
}

const GameController = ({
  // 비디오 관련
  ov,
  session,
  mySessionId,
  streamManager,
  publisher,
  subscribers,
  isMike,
  isCamera,
  isSpeaker,
  currentVideoDevice,
  setOv,
  setSession,
  setMySessionId,
  setStreamManager,
  setPublisher,
  setSubscribers,
  setIsMike,
  setIsCamera,
  setIsSpeaker,
  setCurrentVideoDevice,

  // 미니게임 관련
  t1Pos,
  setT1Pos,
  t2Pos,
  setT2Pos,
  myGameNo,
  setMyGameNo,
  nextThrowUser,
  setNextThrowUser,
  isDiceThrow,
  setIsDiceThrow,
}) => {
  //강제 re-rendering 함수
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);

  // 해솜 - state 불러오는게 에러나서 코드 수정했습니다
  const { userNickname, userNo } = useSelector((state) => state?.auth?.user);

  const handleChangeSessionId = (e) => {
    setMySessionId(e.target.value);
  };

  // //openviduDeployment로 부터 token 가져오기 sessionid 받아서 token 생성
  const getTokenWithSid = async () => {
    const response = await axios.post(
      APPLICATION_SERVER_URL,
      {
        userNo: userNo,
        userNickname: userNickname,
      },
      {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const mySessionId = response.data;
    setMySessionId(mySessionId);

    const res = await axios.put(
      APPLICATION_SERVER_URL + mySessionId,
      {
        userNo: userNo,
        userNickname: userNickname,
      },
      {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  };

  //openvidudployment로 부터 token 가져오기
  const getToken = async (sessionId) => {
    const response = await axios.put(
      APPLICATION_SERVER_URL + mySessionId,
      {
        userNo: userNo,
        userNickname: userNickname,
      },
      {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  };

  // 방 생성
  const initRoom = async () => {
    const tempOv = new OpenVidu();
    setOv(tempOv);

    const tempSession = await tempOv.initSession();
    setSession(tempSession);

    var mySession = tempSession;

    mySession.on("streamCreated", (event) => {
      // OpenVidu -> Session -> UserVideoComponent를 사용하기 때문에 2번째 인자로 HTML
      // 요소 삽입X
      var tempSubscriber = mySession.subscribe(event.stream, undefined);
      var tempSubscribers = subscribers;
      tempSubscribers.push(tempSubscriber);

      // Update the state with the new subscribers
      setSubscribers(tempSubscribers);
      forceUpdate(); // 스트림 생성될때마다 강제 랜더링
    });

    // 사용자가 화상회의를 떠나면 Session 객체에서 소멸된 stream을 받아와 subscribers 상태값 업뎃
    mySession.on("streamDestroyed", (event) => {
      // Remove the stream from 'subscribers' array
      deleteSubscriber(event.stream.streamManager);
    });

    // exception 처리
    mySession.on("exception", (exception) => {
      console.warn(exception);
    });

    // 게임 로직 경계선
    /* ------------------------------------------------------------------------------------------------------------------------ */

    mySession.on("GAME_RESET", (data) => {
      const { reset } = JSON.parse(data.data);
      console.log(`reset? : ${reset}`);

      // 각 게임 정보 초기화
      setT1Pos(0);
      setT2Pos(0);
      setNextThrowUser(0);
    });

    mySession.on("TURN_UPDATE", (data) => {
      const { nextT1Pos, nextT2Pos, beforeGameNo } = JSON.parse(data.data);
      console.log(
        "팀1 다음 포지션 : " +
          nextT1Pos +
          ", 팀2 다음 포지션 : " +
          nextT2Pos +
          ", 이전에 던진 유저 고유넘버 : " +
          beforeGameNo
      );

      // 각 팀 포지션 업데이트
      setT1Pos(nextT1Pos);
      setT2Pos(nextT2Pos);

      // 주사위 던짐 여부 테스트
      if ((beforeGameNo + 1) % 6 == myGameNo) {
        setIsDiceThrow(true);
        console.log("당신은 다음 턴에 주사위를 던집니다.");
      } else {
        setIsDiceThrow(false);
        console.log("당신은 다음 턴에 주사위를 던지지 않습니다.");
      }
    });

    /* ------------------------------------------------------------------------------------------------------------------------ */
    // 게임 로직 경계선

    getTokenWithSid().then((token) => {
      mySession
        .connect(token, { clientData: userNickname })
        .then(async () => {
          var devices = await tempOv.getDevices();
          var videoDevices = devices.filter(
            (device) => device.kind === "videoinput"
          );

          // publisher(자기 자신) 초기화 및 카메라 세팅
          let tempPublisher = tempOv.initPublisher(undefined, {
            audioSource: undefined,
            videoSource: videoDevices[0].deviceId,
            publishAudio: true,
            publishVideo: true,
            resolution: "240x180.4",
            frameRate: 50,
            mirror: false,
          });

          mySession.publish(tempPublisher);

          setCurrentVideoDevice(videoDevices[0]);
          setStreamManager(tempPublisher);
          setPublisher(tempPublisher);
        })
        .catch((error) => {
          console.log(
            "There was an error connecting to the session:",
            error.code,
            error.message
          );
        });
    });
  };

  //방 입장
  const joinRoom = async () => {
    const tempOv = new OpenVidu();
    setOv(tempOv);

    const tempSession = await tempOv.initSession();
    setSession(tempSession);
    var mySession = tempSession;

    mySession.on("streamCreated", (event) => {
      // 구독자 추가
      var tempSubscriber = mySession.subscribe(event.stream, undefined);
      var tempSubscribers = subscribers;
      tempSubscribers.push(tempSubscriber);

      setSubscribers(tempSubscribers);
      forceUpdate(); // 스트림 생성될때마다 강제 랜더링
    });

    // 사용자가 화상회의를 떠나면 Session 객체에서 소멸된 stream을 받아와 subscribers 상태값 업데이트
    mySession.on("streamDestroyed", (event) => {
      deleteSubscriber(event.stream.streamManager);
    });

    mySession.on("exception", (exception) => {
      console.warn(exception);
    });

    getToken().then((token) => {
      mySession
        .connect(token, { clientData: userNickname })
        .then(async () => {
          var devices = await tempOv.getDevices();
          var videoDevices = devices.filter(
            (device) => device.kind === "videoinput"
          );

          let tempPublisher = await tempOv.initPublisherAsync(undefined, {
            audioSource: undefined,
            videoSource: videoDevices[0].deviceId,
            publishAudio: true,
            publishVideo: true,
            resolution: "240x180.4",
            frameRate: 50,
            insertMode: "APPEND",
            mirror: false,
          });

          mySession.publish(tempPublisher);
          setCurrentVideoDevice(videoDevices[0]);
          setStreamManager(tempPublisher);
          setPublisher(tempPublisher);
        })
        .catch((error) => {
          console.log(
            "There was an error connecting to the session:",
            error.code,
            error.message
          );
        });
    });
  };

  const deleteSubscriber = (streamManager) => {
    let targetSubscribers = subscribers;
    let index = targetSubscribers.indexOf(streamManager, 0);
    const removeName = JSON.parse(
      targetSubscribers[index].stream.connection.data
    ).clientData;

    if (index > -1) {
      targetSubscribers.splice(index, 1);
      setSubscribers(targetSubscribers);
    }
  };

  //현재 방에서 나가기
  const leaveSession = () => {
    const mySession = session;

    if (mySession) {
      mySession.disconnect();
    }

    // 관련 변수 초기화
    setOv(null);
    setSession(undefined);
    setSubscribers([]);
    setMySessionId("");
    // setMyUserName("");
    setStreamManager(undefined);
    setPublisher(undefined);
  };

  return (
    <div className="container">
      {session === undefined ? (
        <LobbyPage
          initRoom={initRoom}
          joinRoom={joinRoom}
          sessionId={mySessionId}
          handleChangeSessionId={handleChangeSessionId}
        />
      ) : null}

      {session !== undefined ? (
        <div>
          <SessionIdDiv>
            <h1 id="session-title">Room Code : {mySessionId}</h1>
            <MyButton
              lang={"English"}
              text={"Leave session"}
              onClick={leaveSession}
              type={"is-warning"}
            />
          </SessionIdDiv>
          <GamePage
            ov={ov}
            session={session}
            mySessionId={mySessionId}
            streamManager={streamManager}
            publisher={publisher}
            subscribers={subscribers}
            isMike={isMike}
            isCamera={isCamera}
            isSpeaker={isSpeaker}
            // myUserName={myUserName}
            currentVideoDevice={currentVideoDevice}
            initRoom={initRoom}
            joinRoom={joinRoom}
            leaveSession={leaveSession}
            userNickname={userNickname}
            userNo={userNo}
          />
        </div>
      ) : null}
    </div>
  );
};
export default GameController;
