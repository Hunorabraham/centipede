const can = document.querySelectorAll("canvas")[0];
const draw = can.getContext("2d");
draw.imageSmoothingEnabled = false;
console.log(draw);
can.width = window.innerWidth;
can.height = window.innerWidth/4*3;

const deltaTime = 16;
const planc = deltaTime/1000;

let buttons = [];
document.body.onkeydown=(e)=>{
	let k = e.key.toLowerCase();
	if(!buttons.includes(k)) buttons.push(k);
}
document.body.onkeyup=(e)=>{
	let k = e.key.toLowerCase();
	if(buttons.includes(k)) buttons.splice(buttons.indexOf(k),1);
}

class Mat2{
	constructor(xx,xy,yx,yy){
		this.XX = xx;
		this.XY = xy;
		this.YX = yx;
		this.YY = yy;
	}
	static rotation(phi){
		let sin = Math.sin(phi);
		let cos = Math.cos(phi);
		return new Mat2(cos, -sin, sin, cos);
	}
}

class vec2{
	constructor(x,y){
		this.X = x;
		this.Y = y;
	}
	static Zero(){return new vec2(0,0);}
	add(v){return new vec2(this.X + v.X, this.Y + v.Y);}
	sub(v){return new vec2(this.X - v.X, this.Y - v.Y);}
	mulConst(c){return new vec2(this.X*c,this.Y*c);}
	magnitudeSqrd(){return this.X**2 + this.Y**2;}
	magnitude(){return Math.sqrt(this.X**2 + this.Y**2);}
	angle(){return Math.atan2(this.Y, this.X);}
	mulMat(m){return new vec2(this.X*m.XX + this.Y*m.XY, this.X*m.YX + this.Y*m.YY);}
	duplicate(){return new vec2(this.X, this.Y);}
	normalise(){
		let mag = Math.sqrt(this.X**2 + this.Y**2);
		return new vec2(this.X/mag,this.Y/mag);
	}
	addInto(v){
		this.X += v.X;
		this.Y += v.Y;
	}
	mulConstInto(c){
		this.X *= c;
		this.Y *= c;
	}
	mulMatInto(m){
		let x = this.X*m.XX + this.Y*m.XY;
		let y = this.X*m.YX + this.Y*m.YY;
		this.X = x;
		this.Y = y;
	}
	render(point){
		draw.beginPath();
		draw.moveTo(point.X, point.Y);
		draw.lineTo(point.X+this.X, point.Y+this.Y);
		draw.stroke();
		draw.closePath();
	}
}
function dot(v,w){
	return v.X*w.X+v.Y*w.Y;
}


//w is a (+/-) rotation from v, eg: (1,0) is a positive rotation, PI/2, from (0,1);
function handedness(v,w){
	return Math.sign(v.X*w.Y - v.Y*w.X);
}


class leg{
	constructor(p, offset, desiredOffset, segmentLength){
		this.Parent = p;
		this.Offset = offset;
		this.DesiredOffset = desiredOffset;
		this.StartPoint = p.Pos.add(offset.mulMat(Mat2.rotation(p.Dir.angle())));
		this.SegmentLength = segmentLength;
		this.EndPoint = p.Pos.add(desiredOffset.mulMat(Mat2.rotation(p.Dir.angle())));
		let diff = this.StartPoint.sub(this.EndPoint);
		let phi = Math.acos(diff.magnitude()*0.5 /this.SegmentLength);
		let hand = handedness(this.Parent.Dir, diff);
		phi *= hand;
		this.MidPoint = diff.mulMat(Mat2.rotation(phi)).normalise().mulConst(this.SegmentLength);
	}
	render(){
		draw.lineWidth = 2;
		draw.beginPath();
		//draw.arc(this.StartPoint.X, this.StartPoint.Y, this.SegmentLength*2, 0, Math.PI*2);
		draw.moveTo(this.StartPoint.X, this.StartPoint.Y);
		draw.lineTo(this.MidPoint.X, this.MidPoint.Y);
		draw.lineTo(this.EndPoint.X, this.EndPoint.Y);
		draw.stroke();
		draw.closePath();
	}
	update(){
		let desiredPoint = this.Parent.Pos.add(this.DesiredOffset.mulMat(Mat2.rotation(this.Parent.Dir.angle())));
		this.StartPoint = this.Parent.Pos.add(this.Offset.mulMat(Mat2.rotation(this.Parent.Dir.angle())));
		let diff = this.EndPoint.sub(this.StartPoint);
		let phi = Math.acos(diff.magnitude()*0.5 /this.SegmentLength);
		if(isNaN(phi) || Math.abs(dot(this.Parent.Dir, diff)/diff.magnitude())>0.97){
			this.EndPoint = this.Parent.Pos.add(this.DesiredOffset.mulMat(Mat2.rotation(this.Parent.Dir.angle())));
			diff = this.EndPoint.sub(this.StartPoint);
			phi = Math.acos(diff.magnitude()*0.5 /this.SegmentLength);
		}
		let hand = handedness(diff, this.Parent.Dir);
		phi *= hand;
		this.MidPoint = this.StartPoint.add(diff.mulMat(Mat2.rotation(phi)).normalise().mulConst(this.SegmentLength));
	}
}

class segment{
	constructor(pos, size, dir,col){
		this.Pos = pos;
		this.Col = col;
		this.Size = size;
		this.Vel = vec2.Zero();
		this.Dir = dir;
		this.Forces = vec2.Zero();
		this.Legs = [];
		for(let i = 0; i < 1; i++){
			let l = new leg(this, new vec2(this.Size.X/2, this.Size.Y/2), new vec2(this.Size.X/2, this.Size.Y*2*0.8), this.Size.Y*0.8);
			this.Legs.push(l);
		}
		for(let i = 0; i < 1; i++){
			let l = new leg(this, new vec2(this.Size.X/2, -this.Size.Y/2), new vec2(this.Size.X/2, -this.Size.Y*2*0.8), this.Size.Y*0.8);
			this.Legs.push(l);
		}
	}
	render(){
		this.Legs.forEach((l)=>l.render());
		draw.translate(this.Pos.X, this.Pos.Y);
		draw.rotate(this.Dir.angle());
		draw.beginPath();
		draw.fillStyle = `black`;
		draw.roundRect(-this.Size.X/2,-this.Size.Y/2,this.Size.X, this.Size.Y, this.Size.X/5);
		draw.fill();
		draw.closePath();
		draw.beginPath();
		draw.fillStyle = `hsl(${this.Col}, 90%, 50%)`;
		let ratio = 0.9;
		draw.roundRect(-this.Size.X/2*ratio,-this.Size.Y/2*ratio,this.Size.X*ratio, this.Size.Y*ratio, this.Size.X/5);
		draw.fill();
		draw.closePath();
		draw.resetTransform();
	}
	update(){
		//currently unnecessary
		//this.Vel.addInto(this.Forces);
		//this.Forces.mulConstInto(0);
		this.Pos.addInto(this.Vel.mulConst(planc));
		this.Dir = this.Vel.magnitudeSqrd() == 0? this.Dir: this.Vel.normalise();
		this.Legs.forEach((l)=>l.update());
	}
}

class pede{
	constructor(pos, dir, legs, size, col){
		this.Dir = dir;
		this.Col = col;
		this.Size = size;
		this.Spine = [];
		for(let i = 0; i < legs; i++){
			let t = Math.abs((i-legs/2))/(legs/2);
			let size2 = size*(1+legs/100)*(1-t) + size*(t);
			this.Spine.push(new segment(pos.add(dir.mulConst(-i*size2)), new vec2(size2, size2/8*11), dir, col));
		}
		this.Head = this.Spine[0];
	}
	update(){
		this.Head.update();
		for(let i = 1; i < this.Spine.length; i++){
			let curr = this.Spine[i];
			let prev = this.Spine[i-1];
			/*curr.update();
			curr.Vel = curr.Dir.mulConst(prev.Vel.magnitude());
			let phi = Math.acos(dot(curr.Vel, prev.Vel)/(curr.Vel.magnitude()*prev.Vel.magnitude()));
			let hand = handedness(curr.Vel, prev.Vel);
			phi*= hand;
			let time = this.Size/curr.Vel.magnitude();
			phi*=planc/time;
			curr.Vel.mulMatInto(Mat2.rotation(phi));*/
			curr.Dir = prev.Pos.sub(curr.Pos).normalise();
			curr.Pos = prev.Pos.add(curr.Dir.mulConst(-this.Size));
			this.Spine[i].update();
		}
	}
	render(){
		draw.fillStyle = `hsl(${this.Col}, 90%, 50%)`;
		this.Spine.forEach((segment)=>segment.render());
	}
}

let test = new vec2(100,100);

let sipi = new pede(new vec2(200,200),new vec2(1,0), 30, 8, 0);

sipi.Head.Vel.X = 0;

sipi.render();

/*
can.onmousemove=(e)=>{
	sipi.Head.Pos.X = e.offsetX;
	sipi.Head.Pos.Y = e.offsetY;
}
*/
setInterval(()=>{
	buttons.forEach((button)=>{
		switch(button){
			case "a":
				sipi.Head.Vel = new vec2(-100,0);
				break;
			case "d":
				sipi.Head.Vel = new vec2(100,0);
				break;
			case "s":
				sipi.Head.Vel = new vec2(0,100);
				break;
			case "w":
				sipi.Head.Vel = new vec2(0,-100);
				break;
		}
	});
	
	
	draw.clearRect(0,0,can.width,can.height);
	sipi.update();
	sipi.render();
	
},deltaTime);
