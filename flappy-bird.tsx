"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"

interface Bird {
  x: number
  y: number
  velocity: number
}

interface Pipe {
  x: number
  topHeight: number
  bottomY: number
  passed: boolean
}

interface Food {
  x: number
  y: number
  collected: boolean
}

const GAME_HEIGHT = 600
const GAME_WIDTH = 400
const BIRD_SIZE = 30
const PIPE_WIDTH = 60
const PIPE_GAP = 150
const GRAVITY = 0.5
const JUMP_FORCE = -8
const PIPE_SPEED = 2
const FOOD_SIZE = 20
const HUNGER_DECREASE_RATE = 0.2
const FOOD_NUTRITION = 30

export default function FlappyBird() {
  const [bird, setBird] = useState<Bird>({ x: 100, y: GAME_HEIGHT / 2, velocity: 0 })
  const [pipes, setPipes] = useState<Pipe[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [score, setScore] = useState(0)
  const [hunger, setHunger] = useState(100)
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameOver">("menu")
  const [gameOverReason, setGameOverReason] = useState<"collision" | "starvation" | "">("")

  const gameLoopRef = useRef<number>()
  const pipeTimerRef = useRef<number>(0)
  const foodTimerRef = useRef<number>(0)

  const jump = useCallback(() => {
    if (gameState === "playing") {
      setBird((prev) => ({ ...prev, velocity: JUMP_FORCE }))
    }
  }, [gameState])

  const startGame = () => {
    setBird({ x: 100, y: GAME_HEIGHT / 2, velocity: 0 })
    setPipes([])
    setFoods([])
    setScore(0)
    setHunger(100)
    setGameState("playing")
    setGameOverReason("")
    pipeTimerRef.current = 0
    foodTimerRef.current = 0
  }

  const endGame = (reason: "collision" | "starvation") => {
    setGameState("gameOver")
    setGameOverReason(reason)
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current)
    }
  }

  const checkCollisions = useCallback((currentBird: Bird, currentPipes: Pipe[]) => {
    // Check ground and ceiling collision
    if (currentBird.y + BIRD_SIZE >= GAME_HEIGHT || currentBird.y <= 0) {
      return true
    }

    // Check pipe collision
    for (const pipe of currentPipes) {
      if (
        currentBird.x + BIRD_SIZE > pipe.x &&
        currentBird.x < pipe.x + PIPE_WIDTH &&
        (currentBird.y < pipe.topHeight || currentBird.y + BIRD_SIZE > pipe.bottomY)
      ) {
        return true
      }
    }

    return false
  }, [])

  const checkFoodCollection = useCallback((currentBird: Bird, currentFoods: Food[]) => {
    return currentFoods.map((food) => {
      if (
        !food.collected &&
        currentBird.x + BIRD_SIZE > food.x &&
        currentBird.x < food.x + FOOD_SIZE &&
        currentBird.y + BIRD_SIZE > food.y &&
        currentBird.y < food.y + FOOD_SIZE
      ) {
        return { ...food, collected: true }
      }
      return food
    })
  }, [])

  const gameLoop = useCallback(() => {
    if (gameState !== "playing") return

    setBird((prev) => {
      const newBird = {
        ...prev,
        y: prev.y + prev.velocity,
        velocity: prev.velocity + GRAVITY,
      }

      // Check collisions
      setPipes((currentPipes) => {
        if (checkCollisions(newBird, currentPipes)) {
          endGame("collision")
          return currentPipes
        }
        return currentPipes
      })

      return newBird
    })

    // Update pipes
    setPipes((prev) => {
      const updatedPipes = prev
        .map((pipe) => ({ ...pipe, x: pipe.x - PIPE_SPEED }))
        .filter((pipe) => pipe.x + PIPE_WIDTH > -50)

      // Check for score increase
      updatedPipes.forEach((pipe) => {
        if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
          pipe.passed = true
          setScore((s) => s + 1)
        }
      })

      return updatedPipes
    })

    // Update foods
    setFoods((prev) => {
      const updatedFoods = prev
        .map((food) => ({ ...food, x: food.x - PIPE_SPEED }))
        .filter((food) => food.x + FOOD_SIZE > -50)

      // Check food collection
      const foodsAfterCollection = checkFoodCollection(bird, updatedFoods)

      // Update hunger if food was collected
      const collectedFood = foodsAfterCollection.find(
        (food) => food.collected && !updatedFoods.find((f) => f === food)?.collected,
      )

      if (collectedFood) {
        setHunger((h) => Math.min(100, h + FOOD_NUTRITION))
      }

      return foodsAfterCollection.filter((food) => !food.collected)
    })

    // Update hunger
    setHunger((prev) => {
      const newHunger = Math.max(0, prev - HUNGER_DECREASE_RATE)
      if (newHunger <= 0) {
        endGame("starvation")
      }
      return newHunger
    })

    // Spawn pipes
    pipeTimerRef.current++
    if (pipeTimerRef.current >= 120) {
      // Every 2 seconds at 60fps
      const topHeight = Math.random() * (GAME_HEIGHT - PIPE_GAP - 100) + 50
      setPipes((prev) => [
        ...prev,
        {
          x: GAME_WIDTH,
          topHeight,
          bottomY: topHeight + PIPE_GAP,
          passed: false,
        },
      ])
      pipeTimerRef.current = 0
    }

    // Spawn food
    foodTimerRef.current++
    if (foodTimerRef.current >= 180) {
      // Every 3 seconds at 60fps
      setFoods((prev) => [
        ...prev,
        {
          x: GAME_WIDTH,
          y: Math.random() * (GAME_HEIGHT - 100) + 50,
          collected: false,
        },
      ])
      foodTimerRef.current = 0
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)
  }, [gameState, bird, checkCollisions, checkFoodCollection])

  useEffect(() => {
    if (gameState === "playing") {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState, gameLoop])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        jump()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [jump])

  const getHungerColor = () => {
    if (hunger > 60) return "bg-green-500"
    if (hunger > 30) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getHungerText = () => {
    if (hunger > 60) return "Well Fed"
    if (hunger > 30) return "Hungry"
    if (hunger > 10) return "Starving"
    return "Critical!"
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-400 to-blue-600 p-4">
      <div className="relative">
        {/* Game Container */}
        <div
          className="relative bg-gradient-to-b from-sky-300 to-green-300 border-4 border-brown-600 overflow-hidden cursor-pointer"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          onClick={jump}
        >
          {/* Background clouds */}
          <div className="absolute inset-0">
            <div className="absolute top-10 left-10 w-16 h-10 bg-white rounded-full opacity-70"></div>
            <div className="absolute top-20 right-20 w-12 h-8 bg-white rounded-full opacity-70"></div>
            <div className="absolute top-32 left-32 w-20 h-12 bg-white rounded-full opacity-70"></div>
          </div>

          {/* Ground */}
          <div className="absolute bottom-0 w-full h-20 bg-gradient-to-t from-green-600 to-green-400"></div>

          {/* Bird */}
          {gameState !== "menu" && (
            <div
              className="absolute w-8 h-8 bg-yellow-400 rounded-full border-2 border-orange-400 transition-transform duration-75"
              style={{
                left: bird.x,
                top: bird.y,
                transform: `rotate(${Math.min(Math.max(bird.velocity * 3, -30), 30)}deg)`,
              }}
            >
              {/* Bird eye */}
              <div className="absolute top-1 right-1 w-2 h-2 bg-black rounded-full"></div>
              {/* Bird beak */}
              <div className="absolute top-3 -right-1 w-0 h-0 border-l-2 border-l-orange-500 border-t-2 border-t-transparent border-b-2 border-b-transparent"></div>
            </div>
          )}

          {/* Pipes */}
          {pipes.map((pipe, index) => (
            <div key={index}>
              {/* Top pipe */}
              <div
                className="absolute bg-green-600 border-2 border-green-800"
                style={{
                  left: pipe.x,
                  top: 0,
                  width: PIPE_WIDTH,
                  height: pipe.topHeight,
                }}
              ></div>
              {/* Bottom pipe */}
              <div
                className="absolute bg-green-600 border-2 border-green-800"
                style={{
                  left: pipe.x,
                  top: pipe.bottomY,
                  width: PIPE_WIDTH,
                  height: GAME_HEIGHT - pipe.bottomY - 80,
                }}
              ></div>
            </div>
          ))}

          {/* Food items */}
          {foods.map((food, index) => (
            <div
              key={index}
              className="absolute bg-red-500 rounded-full border-2 border-red-700"
              style={{
                left: food.x,
                top: food.y,
                width: FOOD_SIZE,
                height: FOOD_SIZE,
              }}
            >
              {/* Apple stem */}
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-brown-600"></div>
            </div>
          ))}

          {/* Game States */}
          {gameState === "menu" && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white">
              <h1 className="text-4xl font-bold mb-4 text-yellow-400">Hungry Bird</h1>
              <p className="text-lg mb-2 text-center px-4">Feed the bird while avoiding pipes!</p>
              <p className="text-sm mb-6 text-center px-4 text-gray-300">
                Click or press SPACE to flap
                <br />
                Collect red apples to stay alive
              </p>
              <Button onClick={startGame} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                Start Game
              </Button>
            </div>
          )}

          {gameState === "gameOver" && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white">
              <h2 className="text-3xl font-bold mb-4 text-red-400">Game Over!</h2>
              <p className="text-lg mb-2">
                {gameOverReason === "collision" ? "You hit a pipe!" : "Your bird starved!"}
              </p>
              <p className="text-xl mb-6">Score: {score}</p>
              <Button onClick={startGame} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                Play Again
              </Button>
            </div>
          )}
        </div>

        {/* UI Elements */}
        {gameState === "playing" && (
          <div className="absolute top-4 left-4 right-4">
            {/* Score */}
            <div className="text-2xl font-bold text-white mb-2 text-center drop-shadow-lg">Score: {score}</div>

            {/* Hunger Bar */}
            <div className="bg-black bg-opacity-50 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-sm font-semibold">Hunger</span>
                <span className="text-white text-sm">{getHungerText()}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${getHungerColor()}`}
                  style={{ width: `${hunger}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-white max-w-md">
        <p className="text-sm">
          🐦 Keep your bird fed by collecting red apples while avoiding green pipes!
          <br />💡 Click anywhere or press SPACE to flap
        </p>
      </div>
    </div>
  )
}
