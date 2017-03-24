class MemoryTable extends React.Component {

	constructor(props) {
		super(props);
		this.state = {
			elements: []
		};
	}

	componentDidMount() {
		fetch('/api/memories')
		.then((resp) => {
			resp.json().then((json) => {
				this.setState({
					elements: json.data
				});
			});
		});
	}

	render() {
		return (
		<table className="striped bordered">
		<thead>
			<tr>
				<th>ID</th>
				<th>Title</th>
				<th>Tags</th>
				<th>Date</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
		{ 
			this.state.elements.map((el) => {
				return (
				<tr key={ el.id }>
					<td>{ el.id }</td>
					<td>{ el.title }</td>
					<td>{ el.tags.split(' ').map((e) => <div className="chip">{ e }</div>) }</td>
					<td>{ moment(el.date).calendar() }</td>
					<td>
						<a className="btn-floating red" href={ "/admin/memories/" + el.id }>
							<i className="material-icons">mode_edit</i>
						</a>
					</td>
				</tr>
				);
			}) 
		}
		</tbody>
		</table>
		);
	}

}

window.loadList = () => {
	ReactDOM.render(<MemoryTable />, document.getElementById('main-table'));
}

window.loadModel = () => {
	var $form = $('form');
	$form.submit((e) => {
		e.preventDefault();
		$.ajax({
			url: $form.attr('action'),
			type: $form.attr('method'),
			data: $form.serialize(),
			success: (data) => {
				if (data.error) {
					return Materialize.toast(data.error || 'Unknown error', 4000);
				}
				Materialize.toast('Done', 4000);
			},
			error: () => {
				Materialize.toast('Unknown error', 4000);
			}
		});
	});
};