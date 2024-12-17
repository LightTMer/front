import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(50, 50, 50);
scene.add(light);

const nodes = [];
const links = [];
const nodeObjects = new Map();
const createdLinks = new Set();

function createNode(position, color, data) {
  const geometry = new THREE.SphereGeometry(1, 32, 32);
  const material = new THREE.MeshBasicMaterial({ color });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(...position);
  sphere.userData = data;
  scene.add(sphere);
  return sphere;
}

function createLink(start, end, color = 0xffffff) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  return line;
}

async function fetchData(apiUrl, offset, limit) {
  const url = `${apiUrl}?offset=${offset}&limit=${limit}`;
  const response = await fetch(url);
  return await response.json();
}

async function init(userApi, groupApi, offset, limit) {

  nodes.forEach(node => scene.remove(node));
  links.forEach(link => scene.remove(link));
  nodes.length = 0;
  links.length = 0;

  const users = await fetchData(userApi, offset, limit);
  const groups = await fetchData(groupApi, offset, limit);

  const nodePositions = new Map();

  // Узлы пользователей
  users.forEach(user => {
    const position = randomPositionInCube(50); 
    const color = user.sex === 'Male' ? 0x00ffff : 0xE06666;
    const sphere = createNode(position, color, user);
    nodes.push(sphere);
    nodeObjects.set(user.user_id, sphere);
    nodePositions.set(user.user_id, position);
  });

  // Узлы групп
  groups.forEach(group => {
    const position = randomPositionInCube(50);
    const sphere = createNode(position, 0x9900FF, group);
    nodes.push(sphere);
    nodeObjects.set(group.group_id, sphere);
    nodePositions.set(group.group_id, position);
  });

  // Связи между пользователями (User -> User)
  users.forEach(user => {
    if (user.friends) {
      user.friends.forEach(friendId => {
        const start = nodePositions.get(user.user_id);
        const end = nodePositions.get(friendId);
        if (start && end) {
          links.push(createLink(new THREE.Vector3(...start), new THREE.Vector3(...end)));
        }
      });
    }
  });

  // Связи между пользователями и группами (User -> Group)
  users.forEach(user => {
    groups.forEach(group => {
      if (group.members && group.members.includes(user.user_id)) {
        const start = nodePositions.get(user.user_id);
        const end = nodePositions.get(group.group_id);
        if (start && end) {
          links.push(createLink(new THREE.Vector3(...start), new THREE.Vector3(...end)));
        }
      }
    });
  });
}

function randomPositionInCube(size) {
  return [
    (Math.random() - 0.5) * size,
    (Math.random() - 0.5) * size,
    (Math.random() - 0.5) * size
  ];
}

function onMouseClick(event) {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(nodes);
  if (intersects.length > 0) {
    const selectedNode = intersects[0].object;
    const infoPanel = document.getElementById('node-info');

    infoPanel.innerHTML = `
      <strong>Тип:</strong> ${selectedNode.userData.group_id ? 'Group' : 'User'}<br>
      <strong>Имя:</strong> ${selectedNode.userData.name}<br>
      ${selectedNode.userData.home_town ? `<strong>Город:</strong> ${selectedNode.userData.home_town}` : ''}
    `;
  }
}

document.getElementById('api-form').addEventListener('submit', (event) => {
  event.preventDefault();

  const userApi = document.getElementById('user-api').value;
  const groupApi = document.getElementById('group-api').value;
  const offset = parseInt(document.getElementById('offset').value, 10);
  const limit = parseInt(document.getElementById('limit').value, 10);

  init(userApi, groupApi, offset, limit);
});

window.addEventListener('click', onMouseClick);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
