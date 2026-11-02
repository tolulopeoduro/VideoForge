import React, { useEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import * as THREE from "three";
import { ThreeDScenePreset } from "@/types/schema";

interface ThreeDLayerProps {
  preset?: ThreeDScenePreset;
  accentColor?: string;
  sceneDurationInFrames: number;
}

export const ThreeDLayer: React.FC<ThreeDLayerProps> = ({
  preset = "none",
  accentColor = "#6366f1",
  sceneDurationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store persistent Three.js objects across frames for 60fps performance
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    rootGroup: THREE.Group;
    secondaryGroup: THREE.Group;
    particles?: THREE.Points;
    builtPreset?: string;
    builtColor?: string;
  } | null>(null);

  // Initialize & build geometry when preset or accentColor changes
  useEffect(() => {
    if (!preset || preset === "none") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx = threeRef.current;
    if (!ctx) {
      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      camera.position.set(0, 0, 12);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const pointLight1 = new THREE.PointLight(0xffffff, 2.5, 100);
      pointLight1.position.set(10, 12, 12);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(accentColor, 3.0, 100);
      pointLight2.position.set(-10, -8, 8);
      scene.add(pointLight2);

      const rootGroup = new THREE.Group();
      const secondaryGroup = new THREE.Group();
      scene.add(rootGroup);
      scene.add(secondaryGroup);

      ctx = {
        renderer,
        scene,
        camera,
        rootGroup,
        secondaryGroup,
      };
      threeRef.current = ctx;
    }

    // Rebuild scene meshes if preset or color changed
    if (ctx.builtPreset !== preset || ctx.builtColor !== accentColor) {
      ctx.rootGroup.clear();
      ctx.secondaryGroup.clear();
      ctx.builtPreset = preset;
      ctx.builtColor = accentColor;

      const primaryColor = new THREE.Color(accentColor || "#6366f1");
      const secondaryColor = new THREE.Color("#38bdf8");
      const goldColor = new THREE.Color("#fbbf24");

      // Ambient starfield particles common to all 3D scenes
      const particleCount = preset === "starfield-warp" ? 900 : 280;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        // Deterministic pseudo-random based on index
        const seed1 = Math.sin(i * 12.9898) * 43758.5453;
        const seed2 = Math.sin(i * 78.233) * 43758.5453;
        const seed3 = Math.sin(i * 45.164) * 43758.5453;
        const rx = (seed1 - Math.floor(seed1) - 0.5) * 28;
        const ry = (seed2 - Math.floor(seed2) - 0.5) * 36;
        const rz = (seed3 - Math.floor(seed3) - 0.5) * 24;
        positions[i * 3] = rx;
        positions[i * 3 + 1] = ry;
        positions[i * 3 + 2] = rz;
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: preset === "trophy-arena" ? goldColor : primaryColor,
        size: preset === "starfield-warp" ? 0.16 : 0.11,
        transparent: true,
        opacity: 0.75,
      });
      const points = new THREE.Points(particleGeo, particleMat);
      ctx.secondaryGroup.add(points);
      ctx.particles = points;

      if (preset === "cyber-globe") {
        // Geodesic wireframe globe + glowing inner core + orbital rings
        const globeGeo = new THREE.IcosahedronGeometry(3.4, 3);
        const globeMat = new THREE.MeshBasicMaterial({
          color: primaryColor,
          wireframe: true,
          transparent: true,
          opacity: 0.45,
        });
        ctx.rootGroup.add(new THREE.Mesh(globeGeo, globeMat));

        const coreGeo = new THREE.IcosahedronGeometry(2.1, 2);
        const coreMat = new THREE.MeshStandardMaterial({
          color: primaryColor,
          emissive: primaryColor,
          emissiveIntensity: 0.4,
          roughness: 0.2,
          metalness: 0.8,
          flatShading: true,
          transparent: true,
          opacity: 0.7,
        });
        ctx.rootGroup.add(new THREE.Mesh(coreGeo, coreMat));

        // 2 Tilted Orbital Rings
        const ringGeo1 = new THREE.TorusGeometry(4.6, 0.04, 16, 100);
        const ringMat1 = new THREE.MeshBasicMaterial({
          color: secondaryColor,
          transparent: true,
          opacity: 0.65,
        });
        const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
        ring1.rotation.x = Math.PI / 2.6;
        ring1.rotation.y = 0.4;
        ctx.rootGroup.add(ring1);

        const ringGeo2 = new THREE.TorusGeometry(5.3, 0.03, 16, 100);
        const ringMat2 = new THREE.MeshBasicMaterial({
          color: goldColor,
          transparent: true,
          opacity: 0.4,
        });
        const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
        ring2.rotation.x = -Math.PI / 3;
        ring2.rotation.y = -0.5;
        ctx.rootGroup.add(ring2);
      } else if (preset === "floating-cubes") {
        // 16 Floating Isometric Crystalline Cubes & Octahedrons
        const boxGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
        const octGeo = new THREE.OctahedronGeometry(0.85, 0);

        for (let i = 0; i < 16; i++) {
          const isOct = i % 2 === 0;
          const mat = new THREE.MeshStandardMaterial({
            color: i % 3 === 0 ? goldColor : primaryColor,
            emissive: i % 3 === 0 ? goldColor : primaryColor,
            emissiveIntensity: 0.25,
            metalness: 0.75,
            roughness: 0.2,
            wireframe: i % 4 === 0,
          });
          const mesh = new THREE.Mesh(isOct ? octGeo : boxGeo, mat);
          const angle = (i / 16) * Math.PI * 2;
          const radius = 2.8 + (i % 3) * 1.4;
          mesh.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle * 2) * 3.5,
            Math.sin(angle) * 2.5 - 1
          );
          mesh.rotation.set(i * 0.5, i * 0.8, i * 0.3);
          ctx.rootGroup.add(mesh);
        }
      } else if (preset === "neural-network") {
        // 3D Interconnected Synaptic Nodes + Energy Lines
        const nodeGeo = new THREE.SphereGeometry(0.22, 16, 16);
        const nodePositions: THREE.Vector3[] = [];

        for (let i = 0; i < 24; i++) {
          const phi = Math.acos(-1 + (2 * i) / 24);
          const theta = Math.sqrt(24 * Math.PI) * phi;
          const r = 3.8 + (i % 3) * 0.6;
          const pos = new THREE.Vector3(
            r * Math.cos(theta) * Math.sin(phi),
            r * Math.sin(theta) * Math.sin(phi),
            r * Math.cos(phi)
          );
          nodePositions.push(pos);

          const nodeMat = new THREE.MeshBasicMaterial({
            color: i % 4 === 0 ? goldColor : secondaryColor,
          });
          const sphere = new THREE.Mesh(nodeGeo, nodeMat);
          sphere.position.copy(pos);
          ctx.rootGroup.add(sphere);
        }

        // Connect nearby nodes with lines
        const linePoints: THREE.Vector3[] = [];
        for (let i = 0; i < nodePositions.length; i++) {
          for (let j = i + 1; j < nodePositions.length; j++) {
            if (nodePositions[i].distanceTo(nodePositions[j]) < 3.6) {
              linePoints.push(nodePositions[i], nodePositions[j]);
            }
          }
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
        const lineMat = new THREE.LineBasicMaterial({
          color: primaryColor,
          transparent: true,
          opacity: 0.45,
        });
        ctx.rootGroup.add(new THREE.LineSegments(lineGeo, lineMat));
      } else if (preset === "energy-torus") {
        // 3D Sacred Geometry Torus Knot
        const knotGeo = new THREE.TorusKnotGeometry(2.5, 0.65, 128, 24, 2, 3);
        const knotMat = new THREE.MeshStandardMaterial({
          color: primaryColor,
          emissive: primaryColor,
          emissiveIntensity: 0.3,
          metalness: 0.85,
          roughness: 0.15,
          wireframe: true,
        });
        ctx.rootGroup.add(new THREE.Mesh(knotGeo, knotMat));

        const innerGeo = new THREE.TorusKnotGeometry(2.45, 0.55, 96, 16, 2, 3);
        const innerMat = new THREE.MeshStandardMaterial({
          color: secondaryColor,
          metalness: 0.9,
          roughness: 0.2,
          transparent: true,
          opacity: 0.5,
        });
        ctx.rootGroup.add(new THREE.Mesh(innerGeo, innerMat));
      } else if (preset === "trophy-arena") {
        // Golden Championship Crown / Trophy Pedestal in 3D
        const cupGeo = new THREE.CylinderGeometry(1.8, 0.7, 3.2, 8, 1, false);
        const cupMat = new THREE.MeshStandardMaterial({
          color: goldColor,
          emissive: new THREE.Color("#b45309"),
          emissiveIntensity: 0.35,
          metalness: 0.9,
          roughness: 0.15,
          flatShading: true,
        });
        const cup = new THREE.Mesh(cupGeo, cupMat);
        cup.position.y = 0.6;
        ctx.rootGroup.add(cup);

        const baseGeo = new THREE.CylinderGeometry(1.3, 1.6, 1.2, 8);
        const baseMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#1e293b"),
          metalness: 0.8,
          roughness: 0.2,
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = -1.6;
        ctx.rootGroup.add(base);

        // Floating Golden Crown Ring
        const haloGeo = new THREE.TorusGeometry(2.9, 0.06, 16, 64);
        const haloMat = new THREE.MeshBasicMaterial({ color: goldColor });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotation.x = Math.PI / 2.2;
        halo.position.y = 0.8;
        ctx.rootGroup.add(halo);
      }
    }
  }, [preset, accentColor, width, height]);

  // Dispose WebGL context on unmount
  useEffect(() => {
    return () => {
      if (threeRef.current) {
        threeRef.current.renderer.dispose();
        threeRef.current = null;
      }
    };
  }, []);

  // Deterministic frame-by-frame render driven by Remotion's `useCurrentFrame()`
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx || !preset || preset === "none") return;

    const entranceSpring = spring({
      frame,
      fps,
      config: { damping: 14, mass: 0.9, stiffness: 100 },
    });

    const scale = interpolate(entranceSpring, [0, 1], [0.2, 1.0]);
    const t = frame / fps; // Deterministic seconds

    // Position the 3D centerpiece in upper-center of portrait or center of landscape
    const isPortrait = height > width;
    ctx.rootGroup.position.y = isPortrait ? 1.8 : 0.3;
    ctx.rootGroup.scale.set(scale, scale, scale);

    // Deterministic rotation & animation per preset
    if (preset === "cyber-globe" || preset === "neural-network") {
      ctx.rootGroup.rotation.y = t * 0.55;
      ctx.rootGroup.rotation.x = Math.sin(t * 0.4) * 0.22;
    } else if (preset === "floating-cubes") {
      ctx.rootGroup.rotation.y = t * 0.35;
      ctx.rootGroup.children.forEach((child, idx) => {
        child.rotation.x = t * (0.6 + (idx % 3) * 0.2);
        child.rotation.y = t * (0.4 + (idx % 2) * 0.3);
        child.position.y += Math.sin(t * 2 + idx) * 0.008;
      });
    } else if (preset === "energy-torus") {
      ctx.rootGroup.rotation.x = t * 0.65;
      ctx.rootGroup.rotation.y = t * 0.45;
    } else if (preset === "trophy-arena") {
      ctx.rootGroup.rotation.y = t * 0.7;
      ctx.rootGroup.position.y = (isPortrait ? 1.8 : 0.3) + Math.sin(t * 2.5) * 0.25;
    } else if (preset === "starfield-warp") {
      ctx.secondaryGroup.rotation.z = t * 0.2;
      ctx.secondaryGroup.position.z = (t * 6) % 12;
    }

    // Gentle starfield drift
    if (preset !== "starfield-warp") {
      ctx.secondaryGroup.rotation.y = t * 0.12;
      ctx.secondaryGroup.rotation.x = t * 0.05;
    }

    ctx.renderer.render(ctx.scene, ctx.camera);
  }, [frame, fps, preset, width, height, sceneDurationInFrames]);

  if (!preset || preset === "none") {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
};
