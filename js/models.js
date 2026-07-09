// 愤怒的猪 3D - 角色建模（PRD v2.1 对齐）

const Models = {

    createPig(type) {
        const group = new THREE.Group();
        const colors = {
            normal: { body: 0xFFB6C1, accent: 0xE8588A, dark: 0xC9456E, belly: 0xFFF0E0 },
            speed:  { body: 0xFFE066, accent: 0xFFA500, dark: 0xE8960D, belly: 0xFFF8DC },
            bomb:   { body: 0x555555, accent: 0x333333, dark: 0x111111, belly: 0x444444 },
        };
        const c = colors[type] || colors.normal;

        // 身体
        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 32, 24),
            new THREE.MeshPhongMaterial({ color: c.body, shininess: 40, specular: 0x333333 })
        );
        body.scale.set(1, 0.85, 1.1);
        body.castShadow = true;
        group.add(body);

        // 肚子
        const belly = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 20, 16),
            new THREE.MeshPhongMaterial({ color: c.belly, shininess: 20 })
        );
        belly.position.set(0, -0.15, 0.15);
        belly.scale.set(1, 0.7, 0.8);
        belly.castShadow = true;
        group.add(belly);

        // 鼻子
        const nose = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.2, 0.15, 20),
            new THREE.MeshPhongMaterial({ color: c.dark, shininess: 30 })
        );
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.05, 0.5);
        nose.castShadow = true;
        group.add(nose);

        // 鼻孔
        const nostrilMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
        const nGeo = new THREE.SphereGeometry(0.04, 10, 8);
        const n1 = new THREE.Mesh(nGeo, nostrilMat); n1.position.set(-0.07, 0.05, 0.57); group.add(n1);
        const n2 = new THREE.Mesh(nGeo, nostrilMat); n2.position.set(0.07, 0.05, 0.57); group.add(n2);

        // 眼睛（存储引用以便表情动画）
        const eyeWhiteMat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
        const pupilMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
        const eGeo = new THREE.SphereGeometry(0.1, 16, 12);
        const pGeo = new THREE.SphereGeometry(0.05, 12, 10);

        const eL = new THREE.Mesh(eGeo, eyeWhiteMat); eL.position.set(-0.18, 0.25, 0.38); eL.castShadow = true; group.add(eL);
        const eR = new THREE.Mesh(eGeo, eyeWhiteMat); eR.position.set(0.18, 0.25, 0.38); eR.castShadow = true; group.add(eR);
        const pL = new THREE.Mesh(pGeo, pupilMat); pL.position.set(-0.18, 0.25, 0.45); group.add(pL);
        const pR = new THREE.Mesh(pGeo, pupilMat); pR.position.set(0.18, 0.25, 0.45); group.add(pR);

        // 耳朵
        const earGeo = new THREE.ConeGeometry(0.12, 0.22, 12);
        const earMat = new THREE.MeshPhongMaterial({ color: c.accent, shininess: 30 });
        const earL = new THREE.Mesh(earGeo, earMat);
        earL.position.set(-0.25, 0.45, 0.05); earL.rotation.z = -0.3; earL.castShadow = true; group.add(earL);
        const earR = new THREE.Mesh(earGeo, earMat);
        earR.position.set(0.25, 0.45, 0.05); earR.rotation.z = 0.3; earR.castShadow = true; group.add(earR);

        // 尾巴
        const tail = new THREE.Mesh(
            new THREE.TorusGeometry(0.08, 0.04, 8, 16, Math.PI * 1.5),
            new THREE.MeshPhongMaterial({ color: c.accent, shininess: 30 })
        );
        tail.position.set(0, 0.05, -0.55);
        tail.rotation.y = Math.PI / 2;
        tail.castShadow = true;
        group.add(tail);

        // 特殊标记
        if (type === 'bomb') {
            const fuse = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8),
                new THREE.MeshPhongMaterial({ color: 0xFF6600 })
            );
            fuse.position.set(0, 0.55, 0);
            group.add(fuse);
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 8, 6),
                new THREE.MeshBasicMaterial({ color: 0xFFAA00 })
            );
            spark.position.set(0, 0.68, 0);
            spark.name = 'spark';
            group.add(spark);
        } else if (type === 'speed') {
            const stripeMat = new THREE.MeshPhongMaterial({ color: c.dark });
            const sGeo = new THREE.BoxGeometry(0.5, 0.04, 0.04);
            const s1 = new THREE.Mesh(sGeo, stripeMat); s1.position.set(0, 0.15, -0.4); group.add(s1);
            const s2 = new THREE.Mesh(sGeo, stripeMat); s2.position.set(0, 0.05, -0.4); group.add(s2);
        }

        group.userData = {
            type: 'pig', pigType: type, colors: c,
            eyes: { eL, eR, pL, pR },
        };
        return group;
    },

    setPigExpression(pigGroup, expression) {
        if (!pigGroup.userData.eyes) return;
        const { eL, eR, pL, pR } = pigGroup.userData.eyes;
        switch (expression) {
            case 'normal':
                eL.scale.set(1, 1, 1); eR.scale.set(1, 1, 1);
                pL.scale.set(1, 1, 1); pR.scale.set(1, 1, 1);
                break;
            case 'alert':
                eL.scale.set(1.2, 1.2, 1); eR.scale.set(1.2, 1.2, 1);
                pL.scale.set(1, 1, 1); pR.scale.set(1, 1, 1);
                break;
            case 'panic':
                eL.scale.set(1.5, 1.5, 1); eR.scale.set(1.5, 1.5, 1);
                pL.scale.set(0.8, 0.8, 1); pR.scale.set(0.8, 0.8, 1);
                break;
            case 'hit':
                // 旋转型眼睛
                eL.rotation.z = Math.PI / 4; eR.rotation.z = Math.PI / 4;
                break;
        }
    },

    // 飞鸟：绿色 #4CAF50
    // 站鸟：橙色 #FF9800
    createBird(birdType) {
        const group = new THREE.Group();
        const color = birdType === 'flying' ? 0x4CAF50 : 0xFF9800;

        // 身体
        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 28, 22),
            new THREE.MeshPhongMaterial({ color: color, shininess: 50, specular: 0x444444 })
        );
        body.castShadow = true;
        group.add(body);

        // 肚子
        const belly = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 20, 16),
            new THREE.MeshPhongMaterial({ color: 0xF8F8F8, shininess: 30 })
        );
        belly.position.set(0, -0.12, 0.12);
        belly.scale.set(1, 0.8, 0.9);
        belly.castShadow = true;
        group.add(belly);

        // 嘴
        const beak = new THREE.Mesh(
            new THREE.ConeGeometry(0.1, 0.22, 12),
            new THREE.MeshPhongMaterial({ color: 0xFFA500, shininess: 40 })
        );
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, -0.02, 0.42);
        beak.castShadow = true;
        group.add(beak);

        // 眼睛
        const eyeWhiteMat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
        const pupilMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
        const eGeo = new THREE.SphereGeometry(0.09, 16, 12);
        const pGeo = new THREE.SphereGeometry(0.045, 12, 10);

        const eL = new THREE.Mesh(eGeo, eyeWhiteMat); eL.position.set(-0.15, 0.18, 0.3); group.add(eL);
        const eR = new THREE.Mesh(eGeo, eyeWhiteMat); eR.position.set(0.15, 0.18, 0.3); group.add(eR);
        const pL = new THREE.Mesh(pGeo, pupilMat); pL.position.set(-0.15, 0.18, 0.36); group.add(pL);
        const pR = new THREE.Mesh(pGeo, pupilMat); pR.position.set(0.15, 0.18, 0.36); group.add(pR);

        // 翅膀
        const wingGeo = new THREE.SphereGeometry(0.22, 16, 12);
        wingGeo.scale(0.3, 0.6, 1);
        const wingMat = new THREE.MeshPhongMaterial({ color: Math.floor(color * 0.8), shininess: 30 });
        const wingL = new THREE.Mesh(wingGeo, wingMat);
        wingL.position.set(-0.38, 0, 0); wingL.castShadow = true; group.add(wingL);
        const wingR = new THREE.Mesh(wingGeo, wingMat);
        wingR.position.set(0.38, 0, 0); wingR.castShadow = true; group.add(wingR);

        // 头羽
        const feather = new THREE.Mesh(
            new THREE.ConeGeometry(0.07, 0.22, 8),
            new THREE.MeshPhongMaterial({ color: Math.floor(color * 0.7) })
        );
        feather.position.set(0, 0.42, -0.05); feather.rotation.z = -0.2; feather.castShadow = true; group.add(feather);

        // 尾羽
        const tail = new THREE.Mesh(
            new THREE.ConeGeometry(0.13, 0.28, 8),
            new THREE.MeshPhongMaterial({ color: Math.floor(color * 0.7) })
        );
        tail.position.set(0, 0.05, -0.4); tail.rotation.x = -Math.PI / 2 + 0.3; tail.castShadow = true; group.add(tail);

        group.userData = {
            type: 'bird', wings: [wingL, wingR],
            eyes: { eL, eR, pL, pR },
            birdType: birdType,
        };
        return group;
    },

    setBirdExpression(birdGroup, expression) {
        if (!birdGroup.userData.eyes) return;
        const { eL, eR, pL, pR } = birdGroup.userData.eyes;
        switch (expression) {
            case 'normal':
                eL.scale.set(1, 1, 1); eR.scale.set(1, 1, 1);
                pL.visible = true; pR.visible = true;
                break;
            case 'alert':
                eL.scale.set(1.3, 1.3, 1); eR.scale.set(1.3, 1.3, 1);
                pL.visible = true; pR.visible = true;
                break;
            case 'panic':
                eL.scale.set(1.6, 1.6, 1); eR.scale.set(1.6, 1.6, 1);
                pL.visible = true; pR.visible = true;
                break;
            case 'hit':
                eL.scale.set(1, 1, 1); eR.scale.set(1, 1, 1);
                eL.rotation.z = Math.PI / 3; eR.rotation.z = -Math.PI / 3;
                break;
        }
    },

    createSlingshot() {
        const group = new THREE.Group();
        const woodMat = new THREE.MeshPhongMaterial({ color: 0x8B5A2B, shininess: 10 });
        const darkWoodMat = new THREE.MeshPhongMaterial({ color: 0x6B4423, shininess: 10 });

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.15, 16), darkWoodMat);
        base.position.y = 0.075; base.castShadow = true; group.add(base);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 12), woodMat);
        pole.position.y = 0.75; pole.castShadow = true; group.add(pole);

        const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 12), woodMat);
        forkL.position.set(-0.22, 1.5, 0); forkL.rotation.z = 0.35; forkL.castShadow = true; group.add(forkL);

        const forkR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 12), woodMat);
        forkR.position.set(0.22, 1.5, 0); forkR.rotation.z = -0.35; forkR.castShadow = true; group.add(forkR);

        const bandMat = new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 5 });
        const bandGeo = new THREE.BoxGeometry(0.03, 0.02, 0.4);
        const bandL = new THREE.Mesh(bandGeo, bandMat); bandL.position.set(-0.3, 1.7, 0.1); bandL.rotation.x = -0.3; group.add(bandL);
        const bandR = new THREE.Mesh(bandGeo, bandMat); bandR.position.set(0.3, 1.7, 0.1); bandR.rotation.x = -0.3; group.add(bandR);

        group.userData = { type: 'slingshot' };
        return group;
    },

    createBlock(type, w, h, d) {
        let mat;
        switch(type) {
            case 'ice':
                mat = new THREE.MeshPhongMaterial({
                    color: 0x88DDFF, transparent: true, opacity: 0.65,
                    shininess: 100, specular: 0xFFFFFF
                });
                break;
            case 'wood':
                mat = new THREE.MeshPhongMaterial({ color: 0xC68642, shininess: 15 });
                break;
            case 'stone':
                mat = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 5 });
                break;
            default:
                mat = new THREE.MeshPhongMaterial({ color: 0xAAAAAA });
        }

        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const edges = new THREE.EdgesGeometry(geo);
        const lines = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.25, transparent: true })
        );
        mesh.add(lines);

        mesh.userData = { type: 'block', blockType: type, width: w, height: h, depth: d };
        return mesh;
    },

    createHill(w, h, d) {
        // 山坡：用半球体或斜坡表示
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshPhongMaterial({ color: 0x8B7355, shininess: 5 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const edges = new THREE.EdgesGeometry(geo);
        const lines = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.2, transparent: true })
        );
        mesh.add(lines);

        mesh.userData = { type: 'hill', width: w, height: h, depth: d };
        return mesh;
    },

    createGround() {
        const geo = new THREE.PlaneGeometry(60, 40, 60, 40);
        const mat = new THREE.MeshPhongMaterial({ color: 0x7CB342, shininess: 5 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        return mesh;
    },

    createSky() {
        const geo = new THREE.SphereGeometry(120, 32, 16);
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            uniforms: {
                topColor: { value: new THREE.Color(0x2196F3) },
                midColor: { value: new THREE.Color(0x64B5F6) },
                bottomColor: { value: new THREE.Color(0xBBDEFB) },
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 midColor;
                uniform vec3 bottomColor;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition).y;
                    vec3 color;
                    if (h > 0.0) {
                        color = mix(midColor, topColor, h);
                    } else {
                        color = mix(midColor, bottomColor, -h);
                    }
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
        });
        return new THREE.Mesh(geo, mat);
    },

    createCloud(x, y, z) {
        const group = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF, transparent: true, opacity: 0.9
        });
        const parts = [
            [0.6, 0, 0], [0.45, 0.1, 0.3], [0.5, -0.05, -0.3],
            [0.4, 0.05, 0.6], [0.35, 0, -0.5], [0.3, 0.15, 0]
        ];
        parts.forEach(([r, oy, oz]) => {
            const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
            s.position.set(oy, oy * 0.5, oz);
            group.add(s);
        });
        group.position.set(x, y, z);
        group.userData = { driftSpeed: 0.005 + Math.random() * 0.01 };
        return group;
    },

    createMountain(x, z, scale) {
        const geo = new THREE.ConeGeometry(scale, scale * 1.5, 12);
        const mat = new THREE.MeshPhongMaterial({ color: 0x556B2F, shininess: 5 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, scale * 0.75 - 0.5, z);
        mesh.receiveShadow = true;
        return mesh;
    },

    createSun() {
        const sun = new THREE.Mesh(
            new THREE.SphereGeometry(2, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0xFFEB3B })
        );
        sun.position.set(-20, 25, -30);
        return sun;
    },

    createDebris(color, size) {
        size = size || 0.15;
        const geo = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshPhongMaterial({ color: color });
        return new THREE.Mesh(geo, mat);
    },

    // 轨迹预测点
    createTrajectoryDot() {
        const geo = new THREE.SphereGeometry(0.06, 8, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.6 });
        return new THREE.Mesh(geo, mat);
    },
};
